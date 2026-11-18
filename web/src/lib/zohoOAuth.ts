import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Scopes the running app already uses: CRM modules (deals, contacts,
 * accounts, notes, the Books sync module), settings read, Sheet, and
 * Books. offline access is requested with access_type, not as a scope.
 */
export const ZOHO_OAUTH_SCOPES = [
  "ZohoCRM.modules.ALL",
  "ZohoCRM.settings.READ",
  "ZohoSheet.workbooks.ALL",
  "ZohoBooks.fullaccess.all",
].join(",");

export const ZOHO_OAUTH_CALLBACK_PATH = "/api/zoho/connect/callback";

export function zohoAccountsOrigin(datacenter = process.env.ZOHO_DATACENTER || "com"): string {
  return `https://accounts.zoho.${datacenter}`;
}

export function zohoRedirectUri(origin: string, env: Record<string, string | undefined> = process.env): string {
  const configured = env.ZOHO_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}${ZOHO_OAUTH_CALLBACK_PATH}`;
}

export function buildZohoAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  datacenter?: string;
  scopes?: string;
}): string {
  const url = new URL(`${zohoAccountsOrigin(input.datacenter)}/oauth/v2/auth`);
  url.searchParams.set("scope", input.scopes || ZOHO_OAUTH_SCOPES);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function signOAuthState(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    exp: now + STATE_TTL_MS,
    n: randomBytes(16).toString("hex"),
  })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string, secret: string, now = Date.now()): { userId: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: unknown; exp?: unknown };
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

export class ZohoNotConnectedError extends Error {
  readonly code = "ZOHO_NOT_CONNECTED";
  constructor() {
    super("Connect your Zoho account first");
    this.name = "ZohoNotConnectedError";
  }
}

export class ZohoReconnectError extends Error {
  readonly code = "ZOHO_RECONNECT";
  constructor() {
    super("Reconnect Zoho");
    this.name = "ZohoReconnectError";
  }
}

/** Zoho token-endpoint failures that mean this user's refresh token is dead. */
export function zohoRefreshIsRevoked(_status: number, body: unknown): boolean {
  const error = body && typeof body === "object" && "error" in body
    ? String((body as { error?: unknown }).error || "")
    : "";
  return error === "invalid_grant" || error === "invalid_code" || error === "access_denied";
}

export function quoteFailureText(error: unknown): string {
  if (error instanceof ZohoReconnectError) throw error;
  return error instanceof Error ? error.message : String(error);
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{ refreshToken: string }> {
  const fetchImpl = input.fetchImpl || fetch;
  const resp = await fetchImpl(input.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    }),
  });
  const raw = await resp.text();
  let data: { refresh_token?: string; error?: string } = {};
  try {
    data = raw ? JSON.parse(raw) as { refresh_token?: string; error?: string } : {};
  } catch {
    data = {};
  }
  if (!resp.ok || data.error || !data.refresh_token) {
    throw new Error(data.error ? `Zoho authorization failed (${data.error})` : "Zoho did not return a refresh token");
  }
  return { refreshToken: data.refresh_token };
}
