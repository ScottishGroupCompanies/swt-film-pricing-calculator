/**
 * Zoho API Client — handles OAuth token management and API calls
 * 
 * This module manages Zoho OAuth 2.0 tokens:
 * - Access tokens expire (~1 hour) and are refreshed automatically
 * - Refresh tokens persist indefinitely (until revoked)
 * - Tokens are stored in Vercel environment variables
 * 
 * Required env vars:
 * - ZOHO_CLIENT_ID     — from Zoho API Console
 * - ZOHO_CLIENT_SECRET — from Zoho API Console
 * - ZOHO_REFRESH_TOKEN — generated via OAuth grant flow
 * - ZOHO_CRM_API_BASE  — e.g. https://www.zohoapis.com/crm/v2 (depends on datacenter)
 * - ZOHO_SHEET_API_BASE — e.g. https://sheet.zoho.com/api/v2
 * - ZOHO_ACCOUNTS_URL  — e.g. https://accounts.zoho.com/oauth/v2/token
 */

// Full state name -> USPS 2-letter abbreviation, so a rep typing "Denver,
// Colorado 80202" or "Denver Colorado" doesn't silently fail to parse.
const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

/**
 * Parses a free-typed "City, State ZIP" string into its parts for Zoho's
 * separate City/State/Zip fields. Tolerant of the messy real-world variants
 * reps actually type — missing comma, full state name instead of the 2-letter
 * abbreviation, extra whitespace — because a strict parser silently returning
 * all-empty strings on any of those is exactly what caused "null null null"
 * to get sent to Zoho as a literal address. Returns whatever it CAN parse
 * rather than all-or-nothing.
 */
export function parseCityStateZip(csz?: string): { city: string; state: string; zip: string } {
  if (!csz) return { city: "", state: "", zip: "" };
  const trimmed = csz.trim().replace(/\s+/g, " ");
  if (!trimmed) return { city: "", state: "", zip: "" };

  // Pull the ZIP off the end first (5 digits, optionally +4), if present.
  const zipMatch = trimmed.match(/(\d{5}(?:-\d{4})?)\s*$/);
  const zip = zipMatch ? zipMatch[1] : "";
  const withoutZip = (zipMatch ? trimmed.slice(0, zipMatch.index) : trimmed).replace(/,\s*$/, "").trim();

  if (!withoutZip) return { city: "", state: "", zip };

  // Split on a comma if present ("City, State"); otherwise fall back to
  // splitting on the last whitespace-separated token(s) that match a known
  // state name/abbreviation.
  let cityPart = withoutZip;
  let statePart = "";
  const commaIdx = withoutZip.lastIndexOf(",");
  if (commaIdx !== -1) {
    cityPart = withoutZip.slice(0, commaIdx).trim();
    statePart = withoutZip.slice(commaIdx + 1).trim();
  } else {
    // No comma — try matching a known full state name (possibly multi-word,
    // e.g. "New York") at the end, then a bare 2-letter abbreviation.
    const lower = withoutZip.toLowerCase();
    let matchedName: string | null = null;
    for (const name of Object.keys(STATE_NAME_TO_ABBR)) {
      if (lower.endsWith(name) && (lower.length === name.length || lower[lower.length - name.length - 1] === " ")) {
        if (!matchedName || name.length > matchedName.length) matchedName = name;
      }
    }
    if (matchedName) {
      cityPart = withoutZip.slice(0, withoutZip.length - matchedName.length).trim();
      statePart = matchedName;
    } else {
      const abbrevMatch = withoutZip.match(/^(.+?)\s+([A-Za-z]{2})$/);
      if (abbrevMatch) {
        cityPart = abbrevMatch[1].trim();
        statePart = abbrevMatch[2];
      }
    }
  }

  const stateAbbr = STATE_NAME_TO_ABBR[statePart.toLowerCase()] || (statePart.length === 2 ? statePart.toUpperCase() : "");

  return { city: cityPart, state: stateAbbr, zip };
}


export interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsUrl: string;
  crmApiBase: string;
  sheetApiBase: string;
  booksApiBase: string;
  booksOrgId: string | null;
}

export function getZohoConfig(): ZohoConfig {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  // Default to US datacenter — can be overridden via env
  const datacenter = process.env.ZOHO_DATACENTER || "com";

  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || `https://accounts.zoho.${datacenter}/oauth/v2/token`;
  const crmApiBase = process.env.ZOHO_CRM_API_BASE || `https://www.zohoapis.${datacenter}/crm/v2`;
  const sheetApiBase = process.env.ZOHO_SHEET_API_BASE || `https://sheet.zoho.${datacenter}/api/v2`;
  const booksApiBase = process.env.ZOHO_BOOKS_API_BASE || `https://www.zohoapis.${datacenter}/books/v3`;
  const booksOrgId = process.env.ZOHO_BOOKS_ORG_ID || null;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Zoho credentials. Need ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN set in environment variables."
    );
  }

  return { clientId, clientSecret, refreshToken, accountsUrl, crmApiBase, sheetApiBase, booksApiBase, booksOrgId };
}

// ─── Token Management ────────────────────────────────────────────────────

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get a valid Zoho access token, refreshing if necessary.
 * Access tokens last ~1 hour. We cache and refresh proactively.
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-min safety margin)
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken;
  }

  const config = getZohoConfig();
  
  // Refresh the token
  const params = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const resp = await fetch(config.accountsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Zoho token refresh failed (${resp.status}): ${errorText}`);
  }

  const data = await resp.json();
  
  if (!data.access_token) {
    throw new Error(`Zoho token refresh returned no access_token: ${JSON.stringify(data)}`);
  }

  cachedAccessToken = data.access_token as string;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;

  return cachedAccessToken;
}

// ─── CRM API ─────────────────────────────────────────────────────────────

export interface ZohoCRMRecord {
  [key: string]: unknown;
}

/**
 * Make an authenticated call to Zoho CRM API
 */
export async function crmApiCall(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<unknown> {
  const config = getZohoConfig();
  const token = await getAccessToken();
  
  const url = `${config.crmApiBase}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Zoho-oauthtoken ${token}`,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Zoho returns an empty body (e.g. 204, or 200 with no content) for some
  // GET/search calls that find nothing — guard against JSON parse errors.
  const rawText = await resp.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!resp.ok) {
    throw new Error(`Zoho CRM API error (${resp.status}) ${method} ${path}: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Search for a contact by name or email
 */
export async function searchContact(name: string, email?: string): Promise<ZohoCRMRecord | null> {
  let criteria: string;
  if (email) {
    criteria = `(Email:equals:${email})`;
  } else {
    // Search by name — Zoho uses First_Name and Last_Name separately
    // Try full name match on Last_Name as fallback
    const parts = name.trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : name;
    criteria = `(Last_Name:equals:${lastName})`;
  }

  const result = await crmApiCall("GET", `/Contacts/search?criteria=${encodeURIComponent(criteria)}`) as { data?: ZohoCRMRecord[] };
  return result?.data?.[0] ?? null;
}

/**
 * Search for multiple contacts by partial name/email/phone match — used for
 * the calculator's "search previous contacts" autofill picker. Zoho's
 * word-search endpoint does a fuzzy match across indexed fields.
 */
export async function searchContactsFuzzy(query: string, limit = 10): Promise<ZohoCRMRecord[]> {
  if (!query || query.trim().length < 2) return [];
  const fields = "First_Name,Last_Name,Email,Phone,Mobile,Mailing_Street,Mailing_City,Mailing_State,Mailing_Zip,Account_Name";
  const result = await crmApiCall(
    "GET",
    `/Contacts/search?word=${encodeURIComponent(query.trim())}&fields=${fields}&per_page=${limit}`
  ) as { data?: ZohoCRMRecord[] };
  return result?.data ?? [];
}

/**
 * Fuzzy-search existing Deals (Opportunities) by name/customer — used
 * alongside searchContactsFuzzy so reps can pull an EXISTING job back up
 * (not just a contact) and get its real installation address, which lives
 * on the Deal itself (Installation_Street/City/State/Zip), not on the
 * Contact record.
 */
export async function searchDealsFuzzy(query: string, limit = 10): Promise<ZohoCRMRecord[]> {
  if (!query || query.trim().length < 2) return [];
  const fields = "Deal_Name,Opportunity_Number,Installation_Street,Installation_City,Installation_State,Installation_Zip,Contact_Name,Account_Name,Type,Stage,Modified_Time";
  const result = await crmApiCall(
    "GET",
    `/Deals/search?word=${encodeURIComponent(query.trim())}&fields=${fields}&per_page=${limit}`
  ) as { data?: ZohoCRMRecord[] };
  return result?.data ?? [];
}

/**
 * Create a new contact in Zoho CRM
 */
export async function createContact(contact: {
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  accountId?: string; // Commercial: real Zoho Account record id to link (Contact.Account_Name lookup)
}): Promise<string> {
  const record: ZohoCRMRecord = {
    Last_Name: contact.lastName,
  };
  if (contact.firstName) record.First_Name = contact.firstName;
  if (contact.email) record.Email = contact.email;
  if (contact.phone) record.Phone = contact.phone;
  if (contact.mailingStreet) record.Mailing_Street = contact.mailingStreet;
  if (contact.mailingCity) record.Mailing_City = contact.mailingCity;
  if (contact.mailingState) record.Mailing_State = contact.mailingState;
  if (contact.mailingZip) record.Mailing_Zip = contact.mailingZip;
  if (contact.accountId) record.Account_Name = { id: contact.accountId };

  const result = await crmApiCall("POST", "/Contacts", { data: [record] }) as { data?: { details?: { id?: string } }[] };
  const id = result?.data?.[0]?.details?.id;
  if (!id) throw new Error("Failed to create contact: no ID returned");
  return id;
}

/**
 * Search for a Zoho Account (business/organization record) by name.
 * Used for Commercial jobs so the business itself is a real linked
 * Account record — not just text on the Contact — matching production's
 * "Account Name" lookup field on Deals/Contacts.
 */
export async function searchAccount(name: string): Promise<ZohoCRMRecord | null> {
  if (!name || !name.trim()) return null;
  const criteria = `(Account_Name:equals:${name.trim()})`;
  const result = await crmApiCall("GET", `/Accounts/search?criteria=${encodeURIComponent(criteria)}`) as { data?: ZohoCRMRecord[] };
  return result?.data?.[0] ?? null;
}

/**
 * Create a Zoho Account (business/organization) record — used for
 * Commercial jobs. Field names confirmed from production:
 * Account_Name, Phone, Email, Website, Billing_Street, Billing_City,
 * Billing_Code (zip), Billing_State1, Commercial_Account_Type_WT_and_HI.
 */
export async function createAccount(account: {
  accountName: string;
  phone?: string;
  email?: string;
  website?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
}): Promise<string> {
  const record: ZohoCRMRecord = {
    Account_Name: account.accountName,
  };
  if (account.phone) record.Phone = account.phone;
  if (account.email) record.Email = account.email;
  if (account.website) record.Website = account.website;
  if (account.billingStreet) record.Billing_Street = account.billingStreet;
  if (account.billingCity) record.Billing_City = account.billingCity;
  if (account.billingState) record.Billing_State1 = account.billingState;
  if (account.billingZip) record.Billing_Code = account.billingZip;

  const result = await crmApiCall("POST", "/Accounts", { data: [record] }) as { data?: { details?: { id?: string } }[] };
  const id = result?.data?.[0]?.details?.id;
  if (!id) throw new Error("Failed to create account: no ID returned");
  return id;
}

/**
 * Create a deal/opportunity in Zoho CRM linked to a contact.
 * Returns both the record ID and the full created record (including
 * Zoho's native auto-generated Opportunity/Deal number field) — the
 * field API name for that number varies per org, so it's read from
 * ZOHO_OPPORTUNITY_NUMBER_FIELD (defaults to a common Zoho pattern).
 */
export async function createDeal(deal: {
  dealName: string;
  contactId?: string;
  accountId?: string; // Commercial: real Zoho Account record id (Deal.Account_Name lookup)
  amount: number;
  stage?: string;
  description?: string;
  userName?: string;
  jobType?: "Residential" | "Commercial"; // maps to the Deal's "Type" field
  installationStreet?: string;
  installationCity?: string;
  installationState?: string;
  installationZip?: string;
}): Promise<{ id: string; record: ZohoCRMRecord; opportunityNumber: string | null }> {
  const record: ZohoCRMRecord = {
    Deal_Name: deal.dealName,
    Amount: deal.amount,
    Stage: deal.stage || "Qualification",
  };
  // Zoho expects Contact_Name as an object with id, not a plain string
  if (deal.contactId) record.Contact_Name = { id: deal.contactId };
  if (deal.accountId) record.Account_Name = { id: deal.accountId };
  if (deal.description) record.Description = deal.description;
  if (deal.jobType) record.Type = deal.jobType;
  if (deal.installationStreet) record.Installation_Street = deal.installationStreet;
  if (deal.installationCity) record.Installation_City = deal.installationCity;
  if (deal.installationState) record.Installation_State = deal.installationState;
  if (deal.installationZip) record.Installation_Zip = deal.installationZip;
  // Owner should be a user lookup — skip for now, it needs a user ID not a name
  // if (deal.userName) record.Owner = deal.userName;

  const result = await crmApiCall("POST", "/Deals", { data: [record] }) as { data?: { details?: { id?: string } }[] };
  const id = result?.data?.[0]?.details?.id;
  if (!id) throw new Error("Failed to create deal: no ID returned");

  // Fetch the full record back — auto-number fields are populated by Zoho
  // server-side after creation, they aren't returned in the create response.
  const created = await getRecord("Deals", id);
  const numberField = process.env.ZOHO_OPPORTUNITY_NUMBER_FIELD || "Zoho_Lead_Number";
  const opportunityNumber = created ? ((created[numberField] as string | number | null)?.toString() ?? null) : null;

  return { id, record: created || record, opportunityNumber };
}

/**
 * Add a note to a record (deal or contact)
 */
export async function addNote(parentId: string, parentModule: string, noteTitle: string, noteContent: string): Promise<void> {
  await crmApiCall("POST", "/Notes", {
    data: [{
      Note_Title: noteTitle,
      Note_Content: noteContent,
      Parent_Id: parentId,
      se_module: parentModule,
    }],
  });
}

/**
 * Fetch a single record by ID from any module (e.g. Deals, Contacts)
 */
export async function getRecord(module: string, id: string): Promise<ZohoCRMRecord | null> {
  const result = await crmApiCall("GET", `/${module}/${id}`) as { data?: ZohoCRMRecord[] };
  return result?.data?.[0] ?? null;
}

/**
 * Search for a record in any module by a field (e.g. find a Deal by name)
 */
export async function searchRecords(module: string, criteria: string): Promise<ZohoCRMRecord[]> {
  try {
    const result = await crmApiCall("GET", `/${module}/search?criteria=${encodeURIComponent(criteria)}`) as { data?: ZohoCRMRecord[] };
    return result?.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Update an existing record (e.g. store structured pricing JSON on a Deal)
 */
export async function updateRecord(module: string, id: string, fields: ZohoCRMRecord): Promise<void> {
  await crmApiCall("PUT", `/${module}/${id}`, { data: [{ id, ...fields }] });
}

/**
 * Attach a file (e.g. PDF estimate) to a record in any module.
 * Uses multipart/form-data as required by Zoho's Attachments endpoint.
 */
export async function attachFile(
  module: string,
  recordId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const config = getZohoConfig();
  const token = await getAccessToken();

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), fileName);

  const resp = await fetch(`${config.crmApiBase}/${module}/${recordId}/Attachments`, {
    method: "POST",
    headers: { "Authorization": `Zoho-oauthtoken ${token}` },
    body: form,
  });

  const rawText = await resp.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!resp.ok) {
    throw new Error(`Zoho attachment upload error (${resp.status}): ${JSON.stringify(data)}`);
  }

  const id = data?.data?.[0]?.details?.id;
  if (!id) throw new Error(`Failed to attach file: no ID returned — ${JSON.stringify(data)}`);
  return id;
}

// ─── Estimates / Quotes ──────────────────────────────────────────────────

/**
 * Config for the "Estimates" record in Zoho — this is either the standard
 * Quotes module, or (per Jenny's production org) a custom module. Since we
 * don't have API access to the real production Zoho yet, every field API
 * name here is configurable via env vars so this can be wired up in one
 * pass once real credentials are available — no code changes needed.
 *
 * Required once production Zoho is connected:
 *   ZOHO_ESTIMATE_MODULE            — API name of the module (e.g. "Quotes"
 *                                      or a custom module like "CustomModule5002")
 *   ZOHO_ESTIMATE_DEAL_LOOKUP_FIELD — field on the Estimate record that links
 *                                      back to the Deal/Opportunity (e.g. "Deal_Name")
 *   ZOHO_ESTIMATE_PRODUCT_ID        — id of a generic Product record every
 *                                      line item will reference (Zoho's
 *                                      standard Quotes module requires this;
 *                                      not needed for most custom modules)
 * Optional overrides (defaults shown are Zoho's standard Quotes field names):
 *   ZOHO_ESTIMATE_FIELD_SUBJECT, _ACCOUNT, _CONTACT, _QUOTE_DATE,
 *   _PAYMENT_TERMS, _INSTALL_ADDRESS
 */
export interface EstimateConfig {
  module: string;
  dealLookupField: string;
  productId: string | null;
  fieldSubject: string;
  fieldAccount: string;
  fieldContact: string;
  fieldQuoteDate: string;
  fieldPaymentTerms: string;
  fieldInstallAddress: string;
}

export function getEstimateConfig(): EstimateConfig | null {
  const estimateModule = process.env.ZOHO_ESTIMATE_MODULE;
  const dealLookupField = process.env.ZOHO_ESTIMATE_DEAL_LOOKUP_FIELD;
  if (!estimateModule || !dealLookupField) return null;

  return {
    module: estimateModule,
    dealLookupField,
    productId: process.env.ZOHO_ESTIMATE_PRODUCT_ID || null,
    fieldSubject: process.env.ZOHO_ESTIMATE_FIELD_SUBJECT || "Subject",
    fieldAccount: process.env.ZOHO_ESTIMATE_FIELD_ACCOUNT || "Account_Name",
    fieldContact: process.env.ZOHO_ESTIMATE_FIELD_CONTACT || "Contact_Name",
    fieldQuoteDate: process.env.ZOHO_ESTIMATE_FIELD_QUOTE_DATE || "Quote_Date",
    fieldPaymentTerms: process.env.ZOHO_ESTIMATE_FIELD_PAYMENT_TERMS || "Terms",
    fieldInstallAddress: process.env.ZOHO_ESTIMATE_FIELD_INSTALL_ADDRESS || "Installation_Address",
  };
}

export interface EstimateLineItemInput {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/**
 * Create an Estimate/Quote record in Zoho, linked to a Deal, with line
 * items and a subject/address prefilled — matching the layout of the
 * production Zoho estimate page. Returns the created record's ID so the
 * calculator can build a direct link for the rep to open and review.
 */
export async function createEstimateRecord(input: {
  config: EstimateConfig;
  dealId: string;
  contactId?: string;
  subject: string;
  installAddress?: string;
  quoteDate: string;
  paymentTerms?: string;
  lineItems: EstimateLineItemInput[];
}): Promise<{ id: string }> {
  const { config } = input;

  const record: ZohoCRMRecord = {
    [config.fieldSubject]: input.subject,
    [config.dealLookupField]: { id: input.dealId },
    [config.fieldQuoteDate]: input.quoteDate,
  };
  if (input.contactId) record[config.fieldContact] = { id: input.contactId };
  if (input.installAddress) record[config.fieldInstallAddress] = input.installAddress;
  if (input.paymentTerms) record[config.fieldPaymentTerms] = input.paymentTerms;

  // Standard Zoho Quotes module requires each line item to reference a
  // real Products-module record. Custom modules typically don't have this
  // constraint. Only attach `product` when we have a configured product ID.
  record.Product_Details = input.lineItems.map((li) => {
    const item: ZohoCRMRecord = {
      Quantity: li.quantity,
      list_price: li.rate,
      Discount: 0,
      total: li.amount,
      product_description: li.description,
    };
    if (config.productId) item.product = { id: config.productId };
    return item;
  });

  const result = await crmApiCall("POST", `/${config.module}`, { data: [record] }) as { data?: { details?: { id?: string } }[] };
  const id = result?.data?.[0]?.details?.id;
  if (!id) throw new Error(`Failed to create ${config.module} record: no ID returned`);
  return { id };
}

/**
 * One-time setup helper: creates a single generic "Window Film
 * Installation" Product record in Zoho's Products module. Every quote
 * line item can reference this same product while carrying its own
 * custom description/quantity/rate — this satisfies the standard Quotes
 * module's requirement without needing a full product catalog. Not
 * needed if the Estimates module is a custom module without this
 * constraint. Safe to call once; re-running creates a duplicate, so the
 * resulting ID should be saved to ZOHO_ESTIMATE_PRODUCT_ID.
 */
export async function createGenericEstimateProduct(): Promise<string> {
  const result = await crmApiCall("POST", "/Products", {
    data: [{
      Product_Name: "Window Film Installation",
      Product_Active: true,
      Description: "Generic line item used for all SWT window film estimates — actual description/quantity/rate are set per line item.",
    }],
  }) as { data?: { details?: { id?: string } }[] };
  const id = result?.data?.[0]?.details?.id;
  if (!id) throw new Error("Failed to create generic product: no ID returned");
  return id;
}

// ─── Sheet API ───────────────────────────────────────────────────────────

/**
 * Make an authenticated call to Zoho Sheet API
 */
export async function sheetApiCall(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<unknown> {
  const config = getZohoConfig();
  const token = await getAccessToken();
  
  const url = `${config.sheetApiBase}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Zoho-oauthtoken ${token}`,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(`Zoho Sheet API error (${resp.status}) ${method} ${path}: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Append a row of pricing data to a Zoho Sheet
 * 
 * @param workbookId — Zoho Sheet workbook ID (env: ZOHO_SHEET_WORKBOOK_ID)
 * @param worksheetName — name of the worksheet/tab (env: ZOHO_SHEET_WORKSHEET_NAME)
 * @param rowData — key-value pairs for the row
 */
export async function appendSheetRow(
  workbookId: string,
  worksheetName: string,
  rowData: Record<string, string | number>
): Promise<void> {
  // Zoho Sheet API expects row data as an array of values
  // The column order should match the worksheet headers
  const values = Object.values(rowData);
  
  await sheetApiCall("POST", `/workbooks/${workbookId}/worksheets/${encodeURIComponent(worksheetName)}/rows`, {
    row_array: [values],
  });
}

// ─── Zoho Books API (Estimates with real line items) ────────────────────
//
// The "Fill Out Estimate" feature on the production Opportunity is powered
// by Zoho Books (a separate product from CRM, with its own API/org ID),
// synced into CRM's "Estimates" custom module (CustomModule5002) as a
// lightweight summary. The actual itemized line items (Item Details,
// Category, Quantity, Rate, Amount) live in Books, not CRM.
//
// Requires ZOHO_BOOKS_ORG_ID env var — find it via GET /books/v3/organizations
// (see docs/ZOHO-SETUP.md).

export interface BooksConfig {
  apiBase: string;
  orgId: string;
}

export function getBooksConfig(): BooksConfig | null {
  const config = getZohoConfig();
  if (!config.booksOrgId) return null;
  return { apiBase: config.booksApiBase, orgId: config.booksOrgId };
}

/**
 * Make an authenticated call to the Zoho Books API. organization_id is
 * required on every Books call — appended automatically here.
 */
export async function booksApiCall(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  orgId: string,
  body?: unknown
): Promise<unknown> {
  const config = getZohoConfig();
  const token = await getAccessToken();

  const separator = path.includes("?") ? "&" : "?";
  const url = `${config.booksApiBase}${path}${separator}organization_id=${orgId}`;
  const headers: Record<string, string> = {
    "Authorization": `Zoho-oauthtoken ${token}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await resp.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!resp.ok) {
    throw new Error(`Zoho Books API error (${resp.status}) ${method} ${path}: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Search Zoho Books customers by name (fuzzy). Books contacts sync from
 * CRM automatically — a customer usually already exists for any CRM
 * Contact/Account created via the calculator's "Send to Zoho
 * Opportunities" step, but sync timing can vary.
 */
export async function searchBooksCustomer(orgId: string, name: string): Promise<{ id: string; name: string } | null> {
  // IMPORTANT: Zoho's /contacts endpoint silently drops search_text when
  // contact_type is also present in the same query (confirmed via direct
  // API testing — combining both params returns ALL contacts of that type,
  // ignoring the name filter entirely). So we search by name only, then
  // filter the results to contact_type=customer client-side. Without this
  // filter, a vendor contact (e.g. a supplier/manufacturer) sharing the
  // customer's name could get matched, and Zoho then rejects the Estimate
  // creation with "Make sure that you have selected a contact of the
  // correct contact type (customer/vendor)" (error code 3045) — a real
  // production bug this filter fixes.
  const result = await booksApiCall("GET", `/contacts?search_text=${encodeURIComponent(name)}`, orgId) as {
    contacts?: { contact_id: string; contact_name: string; contact_type?: string }[];
  };
  const customers = (result?.contacts ?? []).filter((c) => c.contact_type === "customer" || !c.contact_type);
  const match = customers.find((c) => c.contact_name.toLowerCase() === name.toLowerCase())
    || customers[0];
  return match ? { id: match.contact_id, name: match.contact_name } : null;
}

/**
 * Create a Zoho Books customer (used when no matching contact is found
 * for a rep's job — e.g. sync from CRM hasn't happened yet).
 */
export async function createBooksCustomer(orgId: string, input: {
  contactName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  billingAddress?: { address?: string; city?: string; state?: string; zip?: string };
}): Promise<string> {
  const payload: Record<string, unknown> = {
    contact_name: input.companyName || input.contactName,
  };
  if (input.companyName) payload.company_name = input.companyName;
  if (input.email) payload.email = input.email;
  if (input.phone) payload.phone = input.phone;
  if (input.billingAddress) {
    payload.billing_address = {
      address: input.billingAddress.address || "",
      city: input.billingAddress.city || "",
      state: input.billingAddress.state || "",
      zip: input.billingAddress.zip || "",
    };
  }

  const result = await booksApiCall("POST", "/contacts", orgId, payload) as { contact?: { contact_id?: string } };
  const id = result?.contact?.contact_id;
  if (!id) throw new Error("Failed to create Books customer: no ID returned");
  return id;
}

/**
 * Search Zoho Books Items catalog by name (fuzzy) — used to map a film
 * category to an existing Item record (e.g. "Frost/Privacy Film",
 * "Security Film", "Solar Film", "Other Film", "Fee (No Tax)"). Every
 * Books estimate line item must reference a real Item record.
 */
export async function searchBooksItem(orgId: string, name: string): Promise<{ id: string; name: string; rate: number } | null> {
  const result = await booksApiCall("GET", `/items?search_text=${encodeURIComponent(name)}`, orgId) as {
    items?: { item_id: string; name: string; rate: number }[];
  };
  const match = result?.items?.find((i) => i.name.toLowerCase() === name.toLowerCase())
    || result?.items?.find((i) => i.name.toLowerCase().includes(name.toLowerCase()))
    || null;
  return match ? { id: match.item_id, name: match.name, rate: match.rate } : null;
}

export interface BooksEstimateLineItem {
  itemId: string;
  name: string;
  description: string;
  rate: number;
  quantity: number;
}

/**
 * Look up how many Books estimates already exist for a given CRM Deal
 * (via zcrm_potential_id) so we can generate the next sequential
 * estimate number. Production numbering follows the pattern
 * "{Opportunity Number}-QT01", "{Opportunity Number}-QT02", etc.
 * (confirmed from real production data, e.g. "WT-03295-QT01").
 */
async function nextBooksEstimateNumber(orgId: string, opportunityNumber: string, dealId: string): Promise<string> {
  try {
    const result = await booksApiCall(
      "GET",
      `/estimates?zcrm_potential_id=${encodeURIComponent(dealId)}&per_page=200`,
      orgId
    ) as { estimates?: { estimate_number?: string }[] };
    const existing = result?.estimates || [];
    // Find the highest existing QT suffix for this deal's estimates.
    let maxSeq = 0;
    for (const est of existing) {
      const match = est.estimate_number?.match(/-QT(\d+)$/);
      if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
    }
    const nextSeq = maxSeq + 1;
    return `${opportunityNumber}-QT${String(nextSeq).padStart(2, "0")}`;
  } catch {
    // If the lookup fails for any reason, fall back to QT01 — Books will
    // reject a true duplicate with a clear error rather than silently
    // overwriting anything, so this fallback is safe.
    return `${opportunityNumber}-QT01`;
  }
}

/**
 * Create an Estimate in Zoho Books, linked back to the CRM Deal
 * (Opportunity) via zcrm_potential_id — this is what makes it show up
 * under "Zoho Finance" on the Opportunity page and syncs a summary record
 * into CRM's CustomModule5002 automatically.
 *
 * This Books organization has manual estimate numbering enabled (not
 * auto-number), so estimate_number must be supplied explicitly on every
 * create call — Zoho returns error code 4018 ("Estimate Number field is
 * blank") otherwise. We derive it from the Deal's Opportunity Number
 * using production's real naming convention.
 */
export async function createBooksEstimate(orgId: string, input: {
  customerId: string;
  dealId: string; // zcrm_potential_id
  opportunityNumber: string; // e.g. "WT-03296" — used to derive estimate_number
  estimateDate: string; // YYYY-MM-DD
  salespersonName?: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  lineItems: BooksEstimateLineItem[];
  // Job-site installation address — populates the Books estimate template's
  // "Installation Address" custom field (api_name: cf_installation_address).
  // Previously never sent, so the field defaulted to a placeholder that
  // rendered literally as "null null null" on generated estimates.
  installationStreet?: string;
  installationCity?: string;
  installationState?: string;
  installationZip?: string;
}): Promise<{ estimateId: string; estimateNumber: string }> {
  const estimateNumber = await nextBooksEstimateNumber(orgId, input.opportunityNumber, input.dealId);

  const payload: Record<string, unknown> = {
    customer_id: input.customerId,
    zcrm_potential_id: input.dealId,
    estimate_number: estimateNumber,
    date: input.estimateDate,
    line_items: input.lineItems.map((li) => ({
      item_id: li.itemId,
      name: li.name,
      description: li.description,
      rate: li.rate,
      quantity: li.quantity,
    })),
  };
  if (input.salespersonName) payload.salesperson_name = input.salespersonName;
  if (input.termsAndConditions) payload.terms = input.termsAndConditions;

  const installationAddressLines = [
    input.installationStreet,
    [input.installationCity, input.installationState, input.installationZip].filter(Boolean).join(" "),
  ].filter((line) => line && line.trim()).join("\n");
  if (installationAddressLines) {
    payload.custom_fields = [
      { api_name: "cf_installation_address", value: installationAddressLines },
    ];
  }

  const result = await booksApiCall("POST", "/estimates", orgId, payload) as {
    estimate?: { estimate_id?: string; estimate_number?: string };
  };
  const estimateId = result?.estimate?.estimate_id;
  if (!estimateId) throw new Error("Failed to create Books estimate: no ID returned");
  return { estimateId, estimateNumber: result?.estimate?.estimate_number || estimateNumber };
}

/**
 * After creating a Books estimate, Zoho's built-in CRM↔Books integration
 * automatically syncs a matching summary record into CRM's "Estimates"
 * custom module (CustomModule5002) — this is the record Jenny actually
 * needs to land on (the URL pattern she confirmed:
 * .../tab/CustomModule5002/<crm record id>).
 *
 * That sync isn't instant, so this polls briefly (a few short retries)
 * for the CustomModule5002 record matching this Deal + estimate number,
 * found via the Potential_Name lookup field (search by the Deal's CRM id)
 * then matched by Name (the estimate number) to disambiguate when a Deal
 * has multiple estimates.
 */
export async function findSyncedCrmEstimateRecord(
  dealId: string,
  estimateNumber: string,
  maxAttempts = 5,
  delayMs = 1500
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await crmApiCall(
        "GET",
        `/CustomModule5002/search?criteria=(Potential_Name:equals:${encodeURIComponent(dealId)})`
      ) as { data?: { id: string; Name?: string }[] };
      const records = result?.data || [];
      const match = records.find((r) => r.Name === estimateNumber) || records[0];
      if (match?.id) return match.id;
    } catch {
      // CRM search occasionally 204s (no content) when nothing matches yet
      // — treat as "not synced yet" and retry rather than failing outright.
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

// ─── Health Check ────────────────────────────────────────────────────────

export interface ZohoHealthStatus {
  configured: boolean;
  missingVars: string[];
  crmReachable: boolean | null;
  sheetReachable: boolean | null;
  tokenValid: boolean | null;
  error?: string;
}

/**
 * Check if Zoho credentials are configured and API is reachable
 */
export async function healthCheck(): Promise<ZohoHealthStatus> {
  const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"];
  const missingVars = required.filter((v) => !process.env[v]);
  
  if (missingVars.length > 0) {
    return {
      configured: false,
      missingVars,
      crmReachable: null,
      sheetReachable: null,
      tokenValid: null,
      error: "Missing required environment variables",
    };
  }

  try {
    // Try to get an access token
    const token = await getAccessToken();
    const tokenValid = !!token;

    // Try a simple CRM API call using a scope this app is actually granted
    // (ZohoCRM.modules.ALL) — /org requires ZohoCRM.org.READ, which isn't
    // part of this app's OAuth scopes and would always report a false
    // "unreachable" even when the real Deals/Contacts/Books calls work fine.
    let crmReachable = false;
    try {
      await crmApiCall("GET", "/Deals?per_page=1");
      crmReachable = true;
    } catch {
      // CRM might not be set up yet — that's ok for health check
    }

    return {
      configured: true,
      missingVars: [],
      crmReachable,
      sheetReachable: null, // Sheet requires a workbook ID to test
      tokenValid,
    };
  } catch (e) {
    return {
      configured: true,
      missingVars: [],
      crmReachable: false,
      sheetReachable: null,
      tokenValid: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
