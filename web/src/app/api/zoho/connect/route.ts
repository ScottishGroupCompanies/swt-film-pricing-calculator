import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/auth";
import { usesOrgZohoToken } from "@/config/reps";
import { getSessionUserId } from "@/lib/sessionCookies";
import { buildZohoAuthorizeUrl, connectOAuthClient, signOAuthState, zohoRedirectUri } from "@/lib/zohoOAuth";

export const ZOHO_OAUTH_STATE_COOKIE = "zoho_oauth_state";

/** Starts the Zoho consent screen for the logged-in rep. */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  const user = userId ? findUserById(userId) : null;
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (usesOrgZohoToken(user.id)) {
    return NextResponse.redirect(new URL("/?zoho=org", request.url));
  }

  const client = connectOAuthClient();
  const redirectUri = zohoRedirectUri(request.nextUrl.origin);
  const state = signOAuthState(user.id, process.env.SESSION_SECRET || "");
  const destination = buildZohoAuthorizeUrl({
    clientId: client.clientId,
    redirectUri,
    state,
    datacenter: process.env.ZOHO_DATACENTER || "com",
  });
  const response = NextResponse.redirect(destination);
  response.cookies.set(ZOHO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
