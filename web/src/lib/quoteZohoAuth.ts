import { quoteZohoTokenChoice } from "@/config/reps";
import type { ZohoConnectionStore } from "./zohoConnectionStore";
import { ZohoNotConnectedError } from "./zohoOAuth";
import { decryptRefreshToken, zohoTokenSecret } from "./zohoTokenCrypto";

export interface QuoteZohoAuth {
  loginId: string;
  refreshToken: string;
  /** "org" is Jenny's stored refresh token. "rep" is that login's own token. */
  source: "org" | "rep";
}

/**
 * Which refresh token creates this quote.
 * Jenny and Admin use the organization token. Other reps use the token
 * they connected. There is no silent fallback unless
 * ZOHO_ORG_TOKEN_FALLBACK=true.
 */
export async function resolveQuoteZohoAuth(
  loginId: string,
  store: ZohoConnectionStore,
  env: Record<string, string | undefined> = process.env,
): Promise<QuoteZohoAuth> {
  const org = env.ZOHO_REFRESH_TOKEN?.trim() || "";
  let repToken: string | null = null;
  try {
    const stored = await store.read(loginId);
    if (stored?.ciphertext) repToken = decryptRefreshToken(stored, zohoTokenSecret(env));
  } catch {
    // A missing store, a 400 from the wrong blob access mode, or a bad
    // ciphertext is "not connected". It must not crash the quote route.
    repToken = null;
  }
  const choice = quoteZohoTokenChoice(loginId, repToken != null, env);
  if (choice === "rep" && repToken) {
    return { loginId, refreshToken: repToken, source: "rep" };
  }
  if (choice === "org") {
    if (!org) throw new Error("Missing Zoho credentials. Need ZOHO_REFRESH_TOKEN set in environment variables.");
    return { loginId, refreshToken: org, source: "org" };
  }
  throw new ZohoNotConnectedError();
}
