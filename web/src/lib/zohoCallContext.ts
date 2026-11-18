import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The refresh token for the Zoho calls in this request.
 * Quote routes set it. Health checks and contact search do not, and
 * those reads keep using ZOHO_REFRESH_TOKEN.
 */
export type ZohoTokenClient = "org" | "connect";

const zohoCallContext = new AsyncLocalStorage<{ refreshToken: string; client: ZohoTokenClient }>();

export function runWithZohoRefreshToken<T>(
  refreshToken: string,
  client: ZohoTokenClient,
  fn: () => Promise<T>,
): Promise<T> {
  return zohoCallContext.run({ refreshToken, client }, fn);
}

/** No quote context means the organization token, refreshed with the Self Client. */
export function zohoCallAuth(env: Record<string, string | undefined> = process.env): { refreshToken: string; client: ZohoTokenClient } {
  const fromCall = zohoCallContext.getStore();
  if (fromCall) return fromCall;
  const org = env.ZOHO_REFRESH_TOKEN;
  if (!org) {
    throw new Error("Missing Zoho credentials. Need ZOHO_REFRESH_TOKEN set in environment variables.");
  }
  return { refreshToken: org, client: "org" };
}
