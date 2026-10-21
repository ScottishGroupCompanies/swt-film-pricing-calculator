// SERVER-ONLY user credentials + commission data.
// IMPORTANT: this file must never be imported from a "use client" component
// or anywhere that ends up in the browser bundle — it contains commission
// rates and password hashes that only the logged-in user themselves should
// ever see. Only import this from route handlers / middleware (server code).
import { createHash } from "crypto";

export interface ServerUser {
  id: string;
  name: string;
  loc: string;
  glassRate: number | null;
  filmRate: number | null; // flat commission rate on film sale total
  passwordHash: string; // sha256 of the plaintext password
  // Stored CRM user id. Deal.Owner when there is no email lookup, and the
  // fallback when a lookup cannot run. ZOHO_CRM_USER_ID_<LOGIN> overrides it.
  zohoUserId?: string;
  // When set, Deal.Owner is resolved from this CRM mailbox first. A stored
  // zohoUserId is used if that lookup fails.
  zohoEmail?: string;
}

function hash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// Passwords: everyone starts on a shared placeholder "0000" except Jenny
// ("1111"), Katie ("0701"), and Amy ("4321"). Real Zoho user IDs pulled from
// the Deals.Owner field on existing production Deals (CRM org 848141664).
export const SERVER_USERS: ServerUser[] = [
  { id: "dana",  name: "Dana",  loc: "Colorado",  glassRate: 0,    filmRate: 0.07, passwordHash: hash("0000"), zohoUserId: "6168763000003575014" },
  // PIN 4321. zohoUserId confirmed for Amy in Zoho CRM org 848141664.
  // Quotes look up amy@scottishwindowtinting.com first. This id is the owner
  // when that lookup cannot run. ZOHO_CRM_USER_ID_AMY still overrides it.
  { id: "amy",   name: "Amy",   loc: "Texas",     glassRate: 0,    filmRate: 0.05, passwordHash: hash("4321"), zohoEmail: "amy@scottishwindowtinting.com", zohoUserId: "6168763000003573001" },
  { id: "blake", name: "Blake", loc: "KS/MO",     glassRate: null, filmRate: 0.15, passwordHash: hash("0000"), zohoUserId: "6168763000003575012" },
  // PIN 0701. zohoUserId confirmed from Zoho CRM Setup → Users → Katie
  // (org 848141664, the id in the user URL). It is the owner when the
  // katie@scottishwindowtinting.com lookup cannot run. ZOHO_CRM_USER_ID_KATIE
  // still overrides it.
  { id: "katie", name: "Katie", loc: "Arizona",   glassRate: null, filmRate: 0,    passwordHash: hash("0701"), zohoEmail: "katie@scottishwindowtinting.com", zohoUserId: "6168763000002178001" },
  { id: "mike",  name: "Mike",  loc: "Tennessee", glassRate: null, filmRate: 0,    passwordHash: hash("0000"), zohoUserId: "6168763000003583005" },
  { id: "jenny", name: "Jenny", loc: "Colorado",  glassRate: null, filmRate: 0.05, passwordHash: hash("1111"), zohoUserId: "6168763000038970001" },
  // Admin test account — used to check whether logging estimates/deals in
  // as a real Zoho ADMIN (rather than a regular rep) resolves the "Account
  // is mandatory" / Permission Denied issue seen when filling out
  // estimates. zohoUserId confirmed live via Modified_By on real CRM
  // records (Scottish Window Tinting Admin).
  { id: "admin", name: "Admin", loc: "Colorado",  glassRate: null, filmRate: 0.05, passwordHash: hash("0000"), zohoUserId: "6168763000000456001" },
];

export function findUserById(id: string): ServerUser | null {
  return SERVER_USERS.find((u) => u.id === id) ?? null;
}

export function verifyLogin(userId: string, password: string): ServerUser | null {
  const user = findUserById(userId);
  if (!user) return null;
  return user.passwordHash === hash(password) ? user : null;
}

// Safe subset to ever send to the browser — no passwordHash, and ONLY for
// the currently-logged-in user (never the full roster).
export interface PublicUser {
  id: string;
  name: string;
  loc: string;
  glassRate: number | null;
  filmRate: number | null;
}

export function toPublicUser(u: ServerUser): PublicUser {
  return { id: u.id, name: u.name, loc: u.loc, glassRate: u.glassRate, filmRate: u.filmRate };
}
