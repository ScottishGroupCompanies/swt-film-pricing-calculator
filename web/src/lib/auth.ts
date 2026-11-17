// SERVER-ONLY user credentials + commission data.
// IMPORTANT: this file must never be imported from a "use client" component
// or anywhere that ends up in the browser bundle — it contains commission
// rates and password hashes that only the logged-in user themselves should
// ever see. Only import this from route handlers / middleware (server code).
import { createHash } from "crypto";
import { repByLogin } from "@/config/reps";

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
function storedZoho(id: string, lookupByEmail = false): Pick<ServerUser, "zohoUserId" | "zohoEmail"> {
  const rep = repByLogin(id);
  if (!rep) throw new Error(`No Zoho mapping for login ${id}`);
  return {
    zohoUserId: rep.crmUserId,
    // Only Amy and Katie resolve Deal.Owner from the mailbox first.
    // The other logins keep the stored CRM user id and do not call users.READ.
    ...(lookupByEmail && rep.email ? { zohoEmail: rep.email } : {}),
  };
}

export const SERVER_USERS: ServerUser[] = [
  { id: "dana",  name: "Dana",  loc: "Colorado",  glassRate: 0,    filmRate: 0.07, passwordHash: hash("0000"), ...storedZoho("dana") },
  // PIN 4321. Owner is the CRM user in web/src/config/reps.ts.
  // Quotes look up the mailbox first. The stored id is the owner when
  // that lookup cannot run. ZOHO_CRM_USER_ID_AMY still overrides it.
  { id: "amy",   name: "Amy",   loc: "Texas",     glassRate: 0,    filmRate: 0.05, passwordHash: hash("4321"), ...storedZoho("amy", true) },
  { id: "blake", name: "Blake", loc: "KS/MO",     glassRate: null, filmRate: 0.15, passwordHash: hash("0000"), ...storedZoho("blake") },
  // PIN 0701. Owner is the CRM user in web/src/config/reps.ts.
  // The mailbox lookup runs first. ZOHO_CRM_USER_ID_KATIE still overrides it.
  { id: "katie", name: "Katie", loc: "Arizona",   glassRate: null, filmRate: 0,    passwordHash: hash("0701"), ...storedZoho("katie", true) },
  { id: "mike",  name: "Mike",  loc: "Tennessee", glassRate: null, filmRate: 0,    passwordHash: hash("0000"), ...storedZoho("mike") },
  { id: "jenny", name: "Jenny", loc: "Colorado",  glassRate: null, filmRate: 0.05, passwordHash: hash("1111"), ...storedZoho("jenny") },
  // Admin test account — used to check whether logging estimates/deals in
  // as a real Zoho ADMIN (rather than a regular rep) resolves the "Account
  // is mandatory" / Permission Denied issue seen when filling out
  // estimates. Owner is the CRM user in web/src/config/reps.ts.
  { id: "admin", name: "Admin", loc: "Colorado",  glassRate: null, filmRate: 0.05, passwordHash: hash("0000"), ...storedZoho("admin") },
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
