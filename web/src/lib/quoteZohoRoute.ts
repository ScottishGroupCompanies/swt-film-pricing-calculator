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
export async function runQuoteZohoRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
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
    if (error instanceof ZohoNotConnectedError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, errors: [error.message] },
        { status: 409 },
      );
    }
    throw error;
  }

  try {
    return await runWithZohoRefreshToken(auth.refreshToken, auth.source === "rep" ? "connect" : "org", handler);
  } catch (error) {
    if (error instanceof ZohoReconnectError && auth.source === "rep") {
      await zohoConnectionStore().remove(user.id);
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, errors: [error.message] },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
