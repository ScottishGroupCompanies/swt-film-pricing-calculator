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
  zohoUserId: string; // real Zoho CRM user ID, used to set Deal.Owner
}

function hash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// Passwords: everyone starts on a shared placeholder "0000" except Jenny,
// who gets her own "1111" — per Jenny's explicit instruction, to be changed
// per-person later. Real Zoho user IDs pulled from the Deals.Owner field
// on existing production Deals (see session notes — CRM org 848141664).
export const SERVER_USERS: ServerUser[] = [
  { id: "dana",  name: "Dana",  loc: "Colorado",  glassRate: 0,    filmRate: 0.07, passwordHash: hash("0000"), zohoUserId: "6168763000003575014" },
  { id: "amy",   name: "Amy",   loc: "Texas",     glassRate: 0,    filmRate: 0.05, passwordHash: hash("0000"), zohoUserId: "6168763000003573001" },
  { id: "blake", name: "Blake", loc: "KS/MO",     glassRate: null, filmRate: 0.15, passwordHash: hash("0000"), zohoUserId: "6168763000003575012" },
  { id: "katie", name: "Katie", loc: "Arizona",   glassRate: null, filmRate: 0,    passwordHash: hash("0000"), zohoUserId: "6168763000002178001" },
  { id: "mike",  name: "Mike",  loc: "Tennessee", glassRate: null, filmRate: 0,    passwordHash: hash("0000"), zohoUserId: "6168763000003583005" },
  { id: "jenny", name: "Jenny", loc: "Colorado",  glassRate: null, filmRate: 0.05, passwordHash: hash("1111"), zohoUserId: "6168763000038970001" },
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
