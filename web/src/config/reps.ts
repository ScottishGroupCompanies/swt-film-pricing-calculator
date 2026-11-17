/**
 * Confirmed Zoho ids for the calculator logins.
 *
 * Read-only checks on 2026-11-17:
 * - CRM Deals Stage picklist from GET /crm/v2/settings/fields?module=Deals
 *   (the same values are on v6, v8, and the only Deals layout).
 * - Books salespersons from GET /books/v3/salespersons (SWT org).
 *   Amy Haley, Katie Pelowich Faith, and the other named rows below are
 *   the records whose email or crm_reference_id matches the login.
 *
 * These ids are not secrets. PINs and OAuth tokens do not belong here.
 * ZOHO_CRM_USER_ID_<LOGIN> and ZOHO_BOOKS_SALESPERSON_ID_<LOGIN> still
 * override a single login when set.
 */

export interface RepRecord {
  /** Calculator login id. */
  id: string;
  /** Name shown in the calculator. */
  name: string;
  /** Mailbox for this login. Null when none is stored on the login or in Books. */
  email: string | null;
  /** Zoho CRM user id. Deal.Owner. */
  crmUserId: string;
  /** Zoho Books salesperson id. Not the CRM user id. */
  booksSalespersonId: string | null;
  /** Name on that Books salesperson record. */
  booksSalespersonName: string | null;
}

export const REPS: readonly RepRecord[] = [
  {
    id: "dana",
    name: "Dana",
    email: "dana@scottishwindowtinting.com",
    crmUserId: "6168763000003575014",
    booksSalespersonId: "4995712000004410056",
    booksSalespersonName: "Dana Hojnacki",
  },
  {
    id: "amy",
    name: "Amy",
    email: "amy@scottishwindowtinting.com",
    crmUserId: "6168763000003573001",
    booksSalespersonId: "4995712000004391009",
    booksSalespersonName: "Amy Haley",
  },
  {
    id: "blake",
    name: "Blake",
    email: "blake@scottishwindowtinting.com",
    crmUserId: "6168763000003575012",
    booksSalespersonId: "4995712000004415021",
    booksSalespersonName: "Blake Parish",
  },
  {
    id: "katie",
    name: "Katie",
    email: "katie@scottishwindowtinting.com",
    crmUserId: "6168763000002178001",
    booksSalespersonId: "4995712000000992001",
    booksSalespersonName: "Katie Pelowich Faith",
  },
  {
    id: "mike",
    name: "Mike",
    email: "mike@scottishwindowtinting.com",
    crmUserId: "6168763000003583005",
    booksSalespersonId: "4995712000004474003",
    booksSalespersonName: "Mike Kinsey",
  },
  {
    id: "jenny",
    name: "Jenny",
    email: null,
    crmUserId: "6168763000038970001",
    // Name-only Books row. It has no email and no CRM reference id.
    booksSalespersonId: "4995712000036111084",
    booksSalespersonName: "Jenny",
  },
  {
    id: "admin",
    name: "Admin",
    email: "swt.admin@scottishwindowtinting.com",
    crmUserId: "6168763000000456001",
    booksSalespersonId: "4995712000000226009",
    booksSalespersonName: "Scottish Window Tinting Admin",
  },
];

export function repByLogin(id: string): RepRecord | undefined {
  return REPS.find((rep) => rep.id === id);
}

/**
 * The only Deals layout returned by GET /crm/v2/settings/layouts?module=Deals.
 * The app does not send Layout. Zoho uses this layout by default.
 */
export const ZOHO_DEALS_LAYOUT = {
  id: "6168763000000091023",
  name: "Standard",
} as const;

/**
 * GET /crm/v6/settings/pipeline and v8, for the Standard layout, returned
 * 204. No pipeline is configured, so the app does not send Pipeline.
 */
export const ZOHO_DEALS_PIPELINE = null;

export interface DealStagePicklistEntry {
  /** What reps see, and what existing Discovery deals store. */
  display: string;
  /** Old system name. Writing this stores that old name on the deal. */
  actual: string;
  /** Same as display on this org. */
  reference: string;
  /** Picklist option id. */
  id: string;
}

/**
 * Deals Stage picklist, display_value → actual_value.
 * Deal.Stage is sent as `display`. WT-03641 was created with the actual
 * value "Qualification", and the CRM page shows Qualification. Deals that
 * show Discovery have Stage stored as "Discovery".
 */
export const DEAL_STAGE_PICKLIST: readonly DealStagePicklistEntry[] = [
  { display: "Discovery", actual: "Qualification", reference: "Discovery", id: "6168763000000006801" },
  { display: "DNQ", actual: "Closed Lost to Competition", reference: "DNQ", id: "6168763000000006819" },
  { display: "Proposal", actual: "Value Proposition", reference: "Proposal", id: "6168763000000006805" },
  { display: "Closed Lost", actual: "Closed Lost", reference: "Closed Lost", id: "6168763000000006817" },
  { display: "Closed Won", actual: "Closed Won", reference: "Closed Won", id: "6168763000000006815" },
];

/** Value written to Deal.Stage. The display name, not the actual_value. */
export function stageValueToSend(stage: string): string {
  const row = DEAL_STAGE_PICKLIST.find((entry) => entry.display === stage);
  return row ? row.display : stage;
}

export interface BooksSalespersonRow {
  salesperson_id?: string;
  salesperson_name?: string;
  salesperson_email?: string;
  crm_reference_id?: string;
  is_active?: boolean;
}

/**
 * Books has returned this list as `salespersons` and, on the live org,
 * as `data`. Reading only `salespersons` skipped every row, including
 * Amy Haley, and the estimate fell back to the display name.
 */
export function booksSalespersonRows(payload: unknown): BooksSalespersonRow[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { salespersons?: unknown; data?: unknown };
  const list = Array.isArray(body.salespersons)
    ? body.salespersons
    : Array.isArray(body.data)
      ? body.data
      : [];
  return list.filter((row): row is BooksSalespersonRow => !!row && typeof row === "object");
}

function activeSalespeople(rows: BooksSalespersonRow[]): BooksSalespersonRow[] {
  return rows.filter((person) => person.is_active !== false && person.salesperson_id);
}

/**
 * Email first, then the CRM user id stored on the salesperson, then the
 * name. "Amy" matches "Amy Haley". A blank stub also named "Amy" does not
 * win when the longer name has an email or a CRM id.
 */
export function matchBooksSalesperson(
  rows: BooksSalespersonRow[],
  query: { email?: string | null; name?: string | null; crmUserId?: string | null },
): { id: string; name: string } | null {
  const people = activeSalespeople(rows);
  const email = (query.email || "").trim().toLowerCase();
  if (email) {
    const hit = people.find((person) => (person.salesperson_email || "").trim().toLowerCase() === email);
    if (hit?.salesperson_id) return { id: String(hit.salesperson_id), name: hit.salesperson_name || "" };
  }
  const crmUserId = (query.crmUserId || "").trim();
  if (crmUserId) {
    const hit = people.find((person) => (person.crm_reference_id || "").trim() === crmUserId);
    if (hit?.salesperson_id) return { id: String(hit.salesperson_id), name: hit.salesperson_name || "" };
  }
  const want = (query.name || "").trim().toLowerCase();
  if (!want) return null;
  const candidates = people.filter((person) => {
    const name = (person.salesperson_name || "").trim().toLowerCase();
    return name === want || name.startsWith(`${want} `);
  });
  const identified = candidates.filter((person) =>
    (person.salesperson_email || "").trim() || (person.crm_reference_id || "").trim()
  );
  const hit = identified.length === 1 ? identified[0] : candidates.length === 1 ? candidates[0] : undefined;
  if (!hit?.salesperson_id) return null;
  return { id: String(hit.salesperson_id), name: hit.salesperson_name || "" };
}

export type BooksSalespersonSource = "env" | "config" | "lookup";

/**
 * Env override, then the committed Books id, then a live list match.
 * The committed id is what the email lookup returns for Amy Haley, kept
 * here so a change in the list response cannot drop her again.
 */
export function resolveRepBooksSalesperson(
  loginId: string,
  env: Record<string, string | undefined>,
  liveRows?: BooksSalespersonRow[] | null,
): { id: string; name: string; source: BooksSalespersonSource } | null {
  const rep = repByLogin(loginId);
  const envId = env[`ZOHO_BOOKS_SALESPERSON_ID_${loginId.toUpperCase()}`]?.trim();
  if (envId) {
    return { id: envId, name: rep?.booksSalespersonName || rep?.name || "", source: "env" };
  }
  if (rep?.booksSalespersonId) {
    return {
      id: rep.booksSalespersonId,
      name: rep.booksSalespersonName || rep.name,
      source: "config",
    };
  }
  if (!rep || !liveRows) return null;
  const match = matchBooksSalesperson(liveRows, {
    email: rep.email,
    name: rep.name,
    crmUserId: rep.crmUserId,
  });
  return match ? { ...match, source: "lookup" } : null;
}
