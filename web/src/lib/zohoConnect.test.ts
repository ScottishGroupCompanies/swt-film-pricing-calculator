import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptRefreshToken, encryptRefreshToken } from "./zohoTokenCrypto.ts";
import {
  ZOHO_OAUTH_SCOPES,
  buildZohoAuthorizeUrl,
  exchangeAuthorizationCode,
  signOAuthState,
  verifyOAuthState,
  zohoRefreshIsRevoked,
} from "./zohoOAuth.ts";

const SECRET = "test-session-secret";

test("a refresh token encrypts to something that is not the token", () => {
  const token = "1000.refresh-token-value";
  const encrypted = encryptRefreshToken(token, SECRET);
  assert.equal(JSON.stringify(encrypted).includes(token), false);
  assert.equal(decryptRefreshToken(encrypted, SECRET), token);
  assert.throws(() => decryptRefreshToken(encrypted, "other-secret"));
});

test("the authorize URL asks for offline access and does not carry the client secret", () => {
  const url = new URL(buildZohoAuthorizeUrl({
    clientId: "1000.client",
    redirectUri: "https://swt-film-pricing-calculator.vercel.app/api/zoho/connect/callback",
    state: "signed-state",
  }));
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "1000.client");
  assert.equal(url.searchParams.get("state"), "signed-state");
  assert.equal(url.searchParams.get("client_secret"), null);
  assert.match(url.searchParams.get("scope") || "", /ZohoCRM\.modules\.ALL/);
  assert.match(ZOHO_OAUTH_SCOPES, /ZohoBooks\.fullaccess\.all/);
  assert.match(ZOHO_OAUTH_SCOPES, /ZohoSheet\.workbooks\.ALL/);
});

test("oauth state is bound to the rep and rejects tampering", () => {
  const state = signOAuthState("amy", SECRET, 1_000);
  assert.deepEqual(verifyOAuthState(state, SECRET, 1_000), { userId: "amy" });
  assert.equal(verifyOAuthState(state, SECRET, 1_000 + 11 * 60 * 1000), null);
  assert.equal(verifyOAuthState(state, "wrong", 1_000), null);
  const chars = state.split("");
  chars[3] = chars[3] === "a" ? "b" : "a";
  assert.equal(verifyOAuthState(chars.join(""), SECRET, 1_000), null);
});

test("a revoked refresh token is a reconnect, and the code exchange does not echo the code", async () => {
  assert.equal(zohoRefreshIsRevoked(400, { error: "invalid_grant" }), true);
  assert.equal(zohoRefreshIsRevoked(200, { error: "invalid_code" }), true);
  assert.equal(zohoRefreshIsRevoked(500, { error: "server_error" }), false);

  let seenCode = "";
  await assert.rejects(
    () => exchangeAuthorizationCode({
      code: "super-secret-code",
      redirectUri: "https://example.com/api/zoho/connect/callback",
      clientId: "id",
      clientSecret: "secret",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      fetchImpl: async (_url, init) => {
        seenCode = String(init?.body || "");
        return new Response(JSON.stringify({ error: "invalid_code" }), { status: 400 });
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes("super-secret-code"), false);
      return true;
    },
  );
  assert.match(seenCode, /super-secret-code/);
});
