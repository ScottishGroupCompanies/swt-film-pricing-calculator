/**
 * Stops a double-tap or a lost response from creating a second Zoho deal
 * or estimate. The record lives in the same Vercel Blob store as rep
 * connections when BLOB_READ_WRITE_TOKEN is set, and in memory otherwise.
 */

import { del, get, put } from "@vercel/blob";

export interface StoredSubmission {
  status: "pending" | "done";
  startedAt: number;
  httpStatus?: number;
  body?: unknown;
}

export interface IdempotencyStore {
  read(key: string): Promise<StoredSubmission | null>;
  /** False when another request already owns the key. */
  createPending(key: string, record: StoredSubmission): Promise<boolean>;
  write(key: string, record: StoredSubmission): Promise<void>;
  remove(key: string): Promise<void>;
}

export function memoryIdempotencyStore(): IdempotencyStore {
  const rows = new Map<string, StoredSubmission>();
  return {
    async read(key) {
      return rows.get(key) ?? null;
    },
    async createPending(key, record) {
      if (rows.has(key)) return false;
      rows.set(key, record);
      return true;
    },
    async write(key, record) {
      rows.set(key, record);
    },
    async remove(key) {
      rows.delete(key);
    },
  };
}

const PREFIX = "quote-submissions/";

function pathname(key: string): string {
  if (!/^[a-z0-9_.:-]+$/i.test(key)) throw new Error("Invalid submission key");
  return `${PREFIX}${key}.json`;
}

export function blobIdempotencyStore(): IdempotencyStore {
  return {
    async read(key) {
      const result = await get(pathname(key), { access: "public", useCache: false });
      if (!result?.stream) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as StoredSubmission;
    },
    async createPending(key, record) {
      try {
        await put(pathname(key), JSON.stringify(record), {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "application/json",
        });
        return true;
      } catch {
        return false;
      }
    },
    async write(key, record) {
      await put(pathname(key), JSON.stringify(record), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    },
    async remove(key) {
      await del(pathname(key)).catch(() => undefined);
    },
  };
}

let store: IdempotencyStore | null = null;

export function idempotencyStore(): IdempotencyStore {
  if (!store) {
    store = process.env.BLOB_READ_WRITE_TOKEN ? blobIdempotencyStore() : memoryIdempotencyStore();
  }
  return store;
}

export function useIdempotencyStore(next: IdempotencyStore): void {
  store = next;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function submissionKey(loginId: string, submissionId: string, kind: "deal" | "estimate"): string {
  return `${loginId}:${kind}:${submissionId}`;
}

/**
 * Run `work` once per key. A second caller waits for the stored response.
 * A pending row older than two minutes can be taken over so a crashed
 * request does not block the rep forever.
 */
export async function oncePerSubmission<T>(
  key: string | null,
  work: () => Promise<{ httpStatus: number; body: T }>,
): Promise<{ httpStatus: number; body: T }> {
  if (!key) return work();
  const rows = idempotencyStore();
  const existing = await rows.read(key).catch(() => null);
  const replay = await waitForDone(rows, key, existing);
  if (replay) return { httpStatus: replay.httpStatus ?? 200, body: replay.body as T };

  const owned = await rows.createPending(key, { status: "pending", startedAt: Date.now() }).catch(() => false);
  if (!owned) {
    const after = await waitForDone(rows, key, await rows.read(key).catch(() => null));
    if (after?.status === "done") return { httpStatus: after.httpStatus ?? 200, body: after.body as T };
    return work();
  }

  try {
    const result = await work();
    const body = result.body as { success?: boolean; dealId?: string | null; estimateId?: string | null };
    if (body && (body.success || body.dealId || body.estimateId)) {
      await rows.write(key, { status: "done", startedAt: Date.now(), httpStatus: result.httpStatus, body: result.body });
    } else {
      await rows.remove(key);
    }
    return result;
  } catch (error) {
    await rows.remove(key).catch(() => undefined);
    throw error;
  }
}

async function waitForDone(
  rows: IdempotencyStore,
  key: string,
  current: StoredSubmission | null,
): Promise<StoredSubmission | null> {
  if (!current) return null;
  if (current.status === "done") return current;
  if (Date.now() - current.startedAt > 120_000) return null;
  for (let attempt = 0; attempt < 40; attempt++) {
    await delay(500);
    const next = await rows.read(key).catch(() => null);
    if (!next) return null;
    if (next.status === "done") return next;
    if (Date.now() - next.startedAt > 120_000) return null;
  }
  return null;
}
