import { NextRequest, NextResponse } from "next/server";
import { verifyLogin } from "@/lib/auth";
import { setSessionCookie } from "@/lib/sessionCookies";

export async function POST(req: NextRequest) {
  let body: { userId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { userId, password } = body;
  if (!userId || !password) {
    return NextResponse.json({ error: "Missing userId or password" }, { status: 400 });
  }

  const user = verifyLogin(userId, password);
  if (!user) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ success: true, name: user.name });
}
