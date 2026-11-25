/**
 * Shared Zoho HTTP behavior: one refresh at a time, timeouts, and retries
 * that do not repeat a create unless Zoho said it did not run (429).
 */

export class ZohoHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ZohoHttpError";
    this.status = status;
    this.body = body;
  }
}

const IMPLIED_ACCESS = /Crm_Implied_Api_Access|implied_api_access/i;

/** A permission message a rep can act on, instead of a raw Zoho payload. */
export function friendlyZohoMessage(status: number, body: unknown, fallback: string): string {
  const raw = typeof body === "string" ? body : JSON.stringify(body ?? "");
  if (IMPLIED_ACCESS.test(raw) || IMPLIED_ACCESS.test(fallback)) {
    return "Zoho refused this login because the user's profile does not include CRM API access (Crm_Implied_Api_Access). A Zoho admin needs to turn on API permission for that profile. The quote itself is fine.";
  }
  if (status === 401) {
    return "Zoho rejected the sign-in for this account. Use Connect Zoho and try the send again.";
  }
  if (status === 429) {
    return "Zoho is rate limiting requests right now. Wait a few seconds and try again. A retry will not create a second opportunity if the first one already went through.";
  }
  if (status >= 500) {
    return "Zoho had a temporary error. Wait a few seconds and try again.";
  }
  return fallback;
}

const flights = new Map<string, Promise<unknown>>();

/** Collapse concurrent refreshes for the same token into one request. */
export function singleFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = flights.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = run().finally(() => {
    if (flights.get(key) === pending) flights.delete(key);
  });
  flights.set(key, pending);
  return pending;
}

export interface ZohoFetchOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  /** Safe to send again. Creates are not. */
  idempotent?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function retryAfterMs(header: string | null): number {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 5000);
  const when = Date.parse(header);
  if (Number.isFinite(when)) return Math.min(Math.max(when - Date.now(), 0), 5000);
  return 0;
}

function shouldRetry(status: number, idempotent: boolean): boolean {
  if (status === 429) return true;
  return idempotent && (status === 502 || status === 503 || status === 504);
}

export async function zohoFetch(options: ZohoFetchOptions): Promise<{ status: number; data: unknown }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = options.idempotent ? 3 : 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const timeoutMs = options.timeoutMs ?? (options.idempotent ? 15000 : 25000);
    try {
      const response = await fetchImpl(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text.slice(0, 500) };
        }
      }
      if (!response.ok) {
        const fallback = `Zoho returned ${response.status} for ${options.method} ${options.url}`;
        if (attempt < attempts && shouldRetry(response.status, options.idempotent === true)) {
          await delay(retryAfterMs(response.headers.get("retry-after")) || 400 * attempt);
          continue;
        }
        throw new ZohoHttpError(friendlyZohoMessage(response.status, data, fallback), response.status, data);
      }
      return { status: response.status, data };
    } catch (error) {
      if (error instanceof ZohoHttpError) throw error;
      lastError = error;
      const aborted = error instanceof Error && error.name === "TimeoutError";
      const network = error instanceof TypeError || aborted;
      if (!(options.idempotent && network && attempt < attempts)) break;
      await delay(400 * attempt);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "Zoho did not respond.";
  throw new ZohoHttpError(
    message.includes("Timeout") || message.includes("aborted")
      ? "Zoho took too long to answer. Check the connection and try again."
      : `Could not reach Zoho. ${message}`,
    0,
    null,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
