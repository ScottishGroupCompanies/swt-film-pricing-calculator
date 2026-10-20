// Resolves which Zoho CRM user owns a deal for the logged-in calculator user.
// Users with a stored id (Dana, Amy, …) keep that id. Users with a Zoho email
// (Katie) are resolved by looking that mailbox up, or by an env override.
// A stored id is never used as a stand-in for an email lookup.

export interface OwnerUser {
  id: string;
  name: string;
  zohoUserId?: string;
  zohoEmail?: string;
}

export interface OwnerResolution {
  id: string;
  source: "env" | "email" | "stored";
}

export type EnvLike = Record<string, string | undefined>;

export function crmUserIdEnvKey(userId: string): string {
  return `ZOHO_CRM_USER_ID_${userId.toUpperCase()}`;
}

export function booksSalespersonIdEnvKey(userId: string): string {
  return `ZOHO_BOOKS_SALESPERSON_ID_${userId.toUpperCase()}`;
}

export function readEnvUserOverride(
  userId: string,
  env: EnvLike,
  prefix: "ZOHO_CRM_USER_ID" | "ZOHO_BOOKS_SALESPERSON_ID",
): string | null {
  const specific = env[`${prefix}_${userId.toUpperCase()}`]?.trim();
  if (specific) return specific;

  if (prefix !== "ZOHO_CRM_USER_ID") return null;
  const raw = env.ZOHO_CRM_USER_IDS?.trim();
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, unknown>;
    const value = map[userId] ?? map[userId.toLowerCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    // A bad JSON map should not block the per-user variable or the email lookup.
  }
  return null;
}

export function matchUserIdByEmail(
  users: { id?: string | null; email?: string | null }[],
  email: string,
): string | null {
  const want = email.trim().toLowerCase();
  if (!want) return null;
  const match = users.find((user) => (user.email || "").trim().toLowerCase() === want && user.id);
  return match?.id ? String(match.id) : null;
}

export async function resolveDealOwner(
  user: OwnerUser,
  lookupByEmail: (email: string) => Promise<string | null>,
  env: EnvLike = process.env,
): Promise<OwnerResolution> {
  const override = readEnvUserOverride(user.id, env, "ZOHO_CRM_USER_ID");
  if (override) return { id: override, source: "env" };

  if (user.zohoEmail) {
    let lookedUp: string | null = null;
    let lookupError: string | null = null;
    try {
      lookedUp = await lookupByEmail(user.zohoEmail);
    } catch (e) {
      lookupError = e instanceof Error ? e.message : String(e);
    }
    if (lookedUp) return { id: lookedUp, source: "email" };

    const key = crmUserIdEnvKey(user.id);
    const why = lookupError
      ? `Zoho CRM user lookup for ${user.zohoEmail} failed (${lookupError}).`
      : `No active Zoho CRM user has the email ${user.zohoEmail}.`;
    throw new Error(
      `${why} Set ${key} to that CRM user's id so ${user.name}'s quotes are owned by the right person.`,
    );
  }

  if (user.zohoUserId) return { id: user.zohoUserId, source: "stored" };
  throw new Error(`No Zoho CRM owner is configured for ${user.name}.`);
}
