import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/auth";
import { getSessionUserId } from "@/lib/sessionCookies";
import { zohoConnectionStore } from "@/lib/zohoConnectionStore";
import { ZOHO_OAUTH_STATE_COOKIE } from "../route";
import { encryptRefreshToken, zohoTokenSecret } from "@/lib/zohoTokenCrypto";
import { connectOAuthClient, exchangeAuthorizationCode, verifyOAuthState, zohoAccountsOrigin, zohoRedirectUri } from "@/lib/zohoOAuth";

function back(request: NextRequest, zoho: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/?zoho=${encodeURIComponent(zoho)}`, request.url));
  response.cookies.set(ZOHO_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

/** Zoho redirects here with ?code&state. Stores the refresh token encrypted. */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  const user = userId ? findUserById(userId) : null;
  if (!user) return back(request, "denied");

  const secret = process.env.SESSION_SECRET || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const cookie = request.cookies.get(ZOHO_OAUTH_STATE_COOKIE)?.value || "";
  if (!state || state !== cookie) return back(request, "denied");
  const verified = verifyOAuthState(state, secret);
  if (!verified || verified.userId !== user.id) return back(request, "denied");

  if (request.nextUrl.searchParams.get("error")) return back(request, "denied");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return back(request, "denied");

  try {
    const client = connectOAuthClient();
    const redirectUri = zohoRedirectUri(request.nextUrl.origin);
    const { refreshToken } = await exchangeAuthorizationCode({
      code,
      redirectUri,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      tokenUrl: process.env.ZOHO_ACCOUNTS_URL || `${zohoAccountsOrigin()}/oauth/v2/token`,
    });
    const encrypted = encryptRefreshToken(refreshToken, zohoTokenSecret());
    await zohoConnectionStore().write({
      loginId: user.id,
      connectedAt: new Date().toISOString(),
      ...encrypted,
    });
    return back(request, "connected");
  } catch {
    return back(request, "denied");
  }
}
