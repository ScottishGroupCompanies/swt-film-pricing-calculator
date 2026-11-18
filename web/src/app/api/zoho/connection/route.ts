import { NextResponse } from "next/server";
import { findUserById } from "@/lib/auth";
import { REPS, orgZohoTokenFallbackEnabled, usesOrgZohoToken } from "@/config/reps";
import { getSessionUserId } from "@/lib/sessionCookies";
import { zohoConnectionStore } from "@/lib/zohoConnectionStore";

/** Whether the logged-in rep has connected Zoho. Jenny and Admin also get the roster. */
export async function GET() {
  const userId = await getSessionUserId();
  const user = userId ? findUserById(userId) : null;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const store = zohoConnectionStore();
  let mine: { connectedAt: string } | null = null;
  try {
    mine = usesOrgZohoToken(user.id) ? null : await store.read(user.id);
  } catch {
    mine = null;
  }
  const body: {
    loginId: string;
    usesOrgToken: boolean;
    connected: boolean;
    /** False only when this rep must connect before sending. */
    canSend: boolean;
    connectedAt: string | null;
    roster?: { id: string; name: string; usesOrgToken: boolean; connected: boolean; connectedAt: string | null }[];
  } = {
    loginId: user.id,
    usesOrgToken: usesOrgZohoToken(user.id),
    connected: usesOrgZohoToken(user.id) || mine != null,
    canSend: usesOrgZohoToken(user.id) || mine != null || orgZohoTokenFallbackEnabled(),
    connectedAt: mine?.connectedAt || null,
  };

  if (usesOrgZohoToken(user.id)) {
    let links: { loginId: string; connectedAt: string }[] = [];
    try {
      links = await store.list();
    } catch {
      links = [];
    }
    const byLogin = new Map(links.map((link) => [link.loginId, link.connectedAt]));
    body.roster = REPS.map((rep) => ({
      id: rep.id,
      name: rep.name,
      usesOrgToken: usesOrgZohoToken(rep.id),
      connected: usesOrgZohoToken(rep.id) || byLogin.has(rep.id),
      connectedAt: byLogin.get(rep.id) || null,
    }));
  }

  return NextResponse.json(body);
}

/** Forget this rep's Zoho connection. */
export async function DELETE() {
  const userId = await getSessionUserId();
  const user = userId ? findUserById(userId) : null;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!usesOrgZohoToken(user.id)) await zohoConnectionStore().remove(user.id);
  return NextResponse.json({ ok: true });
}
