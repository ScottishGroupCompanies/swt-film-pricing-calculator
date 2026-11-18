import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The refresh token for the Zoho calls in this request.
 * Quote routes set it. Health checks and contact search do not, and
 * those reads keep using ZOHO_REFRESH_TOKEN.
 */
const zohoCallContext = new AsyncLocalStorage<{ refreshToken: string }>();

export function runWithZohoRefreshToken<T>(refreshToken: string, fn: () => Promise<T>): Promise<T> {
  return zohoCallContext.run({ refreshToken }, fn);
}

export function refreshTokenForThisCall(env: Record<string, string | undefined> = process.env): string {
  const fromCall = zohoCallContext.getStore()?.refreshToken;
  if (fromCall) return fromCall;
  const org = env.ZOHO_REFRESH_TOKEN;
  if (!org) {
    throw new Error("Missing Zoho credentials. Need ZOHO_REFRESH_TOKEN set in environment variables.");
  }
  return org;
}
