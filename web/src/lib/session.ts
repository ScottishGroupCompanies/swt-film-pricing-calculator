// Server-only signed session cookie helpers (no external auth library —
// simple HMAC-signed cookie: "userId.signature"). Tampering with the userId
// invalidates the signature, so a client can't just set cookie
// swt_session=blake and impersonate another rep.
//
// Uses Web Crypto (crypto.subtle) instead of Node's `crypto` module so this
// file works in both the Node runtime (route handlers) AND the Edge runtime
// (middleware) without any bundler special-casing.

export const SESSION_COOKIE_NAME = "swt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail loudly rather than silently using a guessable default — an
    // unset secret would make session cookies forgeable.
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function importKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(userId: string): Promise<string> {
  const key = await importKey();
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(userId));
  return toHex(sig);
}

export async function makeSessionValue(userId: string): Promise<string> {
  return `${userId}.${await sign(userId)}`;
}

// Constant-time-ish comparison for hex strings (equal length after hex
// decode; timingSafeEqual isn't available in Edge, so compare byte-by-byte
// without early return).
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifySessionValue(value: string | undefined | null): Promise<string | null> {
  if (!value) return null;
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const userId = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);
  const expected = await sign(userId);
  return safeEqualHex(signature, expected) ? userId : null;
}
