import { del, get, list, put } from "@vercel/blob";
import type { EncryptedZohoToken } from "./zohoTokenCrypto";

export interface StoredZohoConnection extends EncryptedZohoToken {
  loginId: string;
  connectedAt: string;
}

export interface ZohoConnectionStore {
  read(loginId: string): Promise<StoredZohoConnection | null>;
  write(record: StoredZohoConnection): Promise<void>;
  remove(loginId: string): Promise<void>;
  /** Metadata only. Does not decrypt tokens. */
  list(): Promise<{ loginId: string; connectedAt: string }[]>;
}

const PREFIX = "zoho-connections/";

function pathname(loginId: string): string {
  if (!/^[a-z0-9_-]+$/.test(loginId)) throw new Error("Invalid login id");
  return `${PREFIX}${loginId}.json`;
}

export function memoryZohoConnectionStore(): ZohoConnectionStore {
  const rows = new Map<string, StoredZohoConnection>();
  return {
    async read(loginId) {
      return rows.get(loginId) || null;
    },
    async write(record) {
      rows.set(record.loginId, record);
    },
    async remove(loginId) {
      rows.delete(loginId);
    },
    async list() {
      return [...rows.values()].map((row) => ({ loginId: row.loginId, connectedAt: row.connectedAt }));
    },
  };
}

async function readBlob(loginId: string): Promise<StoredZohoConnection | null> {
  const result = await get(pathname(loginId), { access: "private", useCache: false });
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text) as StoredZohoConnection;
  if (!parsed?.ciphertext || parsed.loginId !== loginId) return null;
  return parsed;
}

export function blobZohoConnectionStore(): ZohoConnectionStore {
  return {
    read: readBlob,
    async write(record) {
      await put(pathname(record.loginId), JSON.stringify(record), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    },
    async remove(loginId) {
      await del(pathname(loginId));
    },
    async list() {
      const found: { loginId: string; connectedAt: string }[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: PREFIX, cursor, limit: 100 });
        for (const blob of page.blobs) {
          const loginId = blob.pathname.slice(PREFIX.length).replace(/\.json$/, "");
          if (!loginId) continue;
          found.push({ loginId, connectedAt: blob.uploadedAt.toISOString() });
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return found;
    },
  };
}

let singleton: ZohoConnectionStore | null = null;

export function zohoConnectionStore(): ZohoConnectionStore {
  if (!singleton) singleton = blobZohoConnectionStore();
  return singleton;
}
