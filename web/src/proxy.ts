import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionValue } from "@/lib/session";

// Public paths that don't require a session: the login page itself, the
// login API (which issues the session), Next's static assets, and the
// favicon. Everything else — including the calculator page and every other
// API route — requires a valid signed session cookie.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  let userId: string | null = null;
  try {
    userId = await verifySessionValue(cookieValue);
  } catch (e) {
    // verifySessionValue throws if SESSION_SECRET isn't configured — this
    // runs on EVERY request, so an uncaught throw here would crash the
    // whole dev/prod server rather than just failing one request. Log
    // loudly and treat it as "not authenticated" instead of letting it
    // propagate.
    console.error("[proxy] session verification failed (is SESSION_SECRET set?):", e);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Server misconfigured (SESSION_SECRET not set)" }, { status: 500 });
    }
  }

  if (!userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's internal assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
