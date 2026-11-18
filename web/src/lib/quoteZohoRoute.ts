import { NextResponse } from "next/server";
import { findUserById } from "@/lib/auth";
import { getSessionUserId } from "@/lib/sessionCookies";
import { runWithZohoRefreshToken } from "./zohoCallContext";
import { zohoConnectionStore } from "./zohoConnectionStore";
import { resolveQuoteZohoAuth } from "./quoteZohoAuth";
import { ZohoNotConnectedError, ZohoReconnectError } from "./zohoOAuth";

/**
 * Runs a quote write as the logged-in rep. Jenny and Admin use the
 * organization token. Anyone else must have connected Zoho.
 */
function jsonError(error: unknown, status: number, code?: string): NextResponse {
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json(
    { success: false, error: message, code, errors: [message] },
    { status },
  );
}

export async function runQuoteZohoRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId();
    const user = userId ? findUserById(userId) : null;
    if (!user) {
      return NextResponse.json(
        { success: false, errors: ["Deal creation failed: no logged-in rep, so Zoho records were not created."] },
        { status: 401 },
      );
    }

    let auth;
    try {
      auth = await resolveQuoteZohoAuth(user.id, zohoConnectionStore());
    } catch (error) {
      if (error instanceof ZohoNotConnectedError) return jsonError(error, 409, error.code);
      return jsonError(error, 500);
    }

    try {
      return await runWithZohoRefreshToken(auth.refreshToken, auth.source === "rep" ? "connect" : "org", handler);
    } catch (error) {
      if (error instanceof ZohoReconnectError && auth.source === "rep") {
        await zohoConnectionStore().remove(user.id).catch(() => undefined);
        return jsonError(error, 401, error.code);
      }
      return jsonError(error, 500);
    }
  } catch (error) {
    return jsonError(error, 500);
  }
}
