import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/sessionCookies";
import { findUserById, toPublicUser } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const user = findUserById(userId);
  if (!user) {
    // Session cookie is valid but points at a user that no longer exists
    // (e.g. removed from the roster) — treat as logged out.
    return NextResponse.json({ user: null }, { status: 401 });
  }
  // Only ever return the CALLER's own data — never the full roster, never
  // another user's commission rate.
  return NextResponse.json({ user: toPublicUser(user) });
}
