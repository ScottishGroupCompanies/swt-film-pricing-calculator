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

import {
  formatInstallationAddress,
  toBooksAddress,
} from "./address";
import type { BooksCustomerLinkClient, LinkedBooksCustomer } from "./booksCustomerLink";

export {
  formatCityStateZip,
  formatInstallationAddress,
  parseCityStateZip,
  sanitizeAddressPart,
  toBooksAddress,
} from "./address";


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

  // Explicitly request Account_Name — every Contact has ONE (Zoho
  // auto-creates a personal Account per Contact even for plain
  // Residential customers), and callers need it to link that same
  // Account onto the Deal (required by this org's "Accounts & its
  // contacts sync" Books setting — see submit-pricing/route.ts).
  const result = await crmApiCall(
    "GET",
    `/Contacts/search?criteria=${encodeURIComponent(criteria)}&fields=First_Name,Last_Name,Email,Phone,Mobile,Mailing_Street,Mailing_City,Mailing_State,Mailing_Zip,Account_Name`
  ) as { data?: ZohoCRMRecord[] };
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
 * Fuzzy-search Leads ("Prospects") by name/company — people who haven't
 * been converted to a Contact/Deal yet. No installation address exists
 * yet for these (no Deal), so picking one only prefills name/company/
 * contact info, not a job address.
 */
export async function searchLeadsFuzzy(query: string, limit = 10): Promise<ZohoCRMRecord[]> {
  if (!query || query.trim().length < 2) return [];
  const fields = "Full_Name,First_Name,Last_Name,Company,Email,Phone,Mobile,Street,City,State,Zip_Code,Lead_Status";
  const result = await crmApiCall(
    "GET",
    `/Leads/search?word=${encodeURIComponent(query.trim())}&fields=${fields}&per_page=${limit}`
  ) as { data?: ZohoCRMRecord[] };
  return result?.data ?? [];
}

/**
 * Fuzzy-search Accounts (businesses) directly by name — separate from the
 * exact-match searchAccount() used during Deal/Estimate creation. Lets a
 * rep search "search previous jobs" by a business name and pull in its
 * info directly, without needing an existing Contact/Deal to find it via.
 */
export async function searchAccountsFuzzy(query: string, limit = 10): Promise<ZohoCRMRecord[]> {
  if (!query || query.trim().length < 2) return [];
  const fields = "Account_Name,Phone,Email,Website,Billing_Street,Billing_City,Billing_State1,Billing_Code,Account_Type";
  const result = await crmApiCall(
    "GET",
    `/Accounts/search?word=${encodeURIComponent(query.trim())}&fields=${fields}&per_page=${limit}`
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
  ownerZohoUserId?: string; // real Zoho CRM user ID — sets Deal.Owner so the logged-in rep is the Opportunity Owner
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
  // Owner is a user lookup — needs a real Zoho user ID, not a display name.
  if (deal.ownerZohoUserId) record.Owner = { id: deal.ownerZohoUserId };

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

export interface BooksCustomerRecord extends LinkedBooksCustomer {
  name: string;
  contactPersonCount: number;
  billingState: string | null;
  billingZip: string | null;
}

function asBooksCustomer(contact: {
  contact_id?: string | number;
  contact_name?: string;
  contact_type?: string;
  zcrm_account_id?: string | number | null;
  zcrm_contact_id?: string | number | null;
  contact_persons?: unknown[];
  billing_address?: { state?: string | null; state_code?: string | null; zip?: string | number | null };
} | null | undefined): BooksCustomerRecord | null {
  if (!contact?.contact_id) return null;
  if (contact.contact_type && contact.contact_type !== "customer") return null;
  const billingState = contact.billing_address?.state_code || contact.billing_address?.state || "";
  const billingZip = contact.billing_address?.zip != null ? String(contact.billing_address.zip) : "";
  return {
    id: String(contact.contact_id),
    name: contact.contact_name || "",
    zcrmAccountId: contact.zcrm_account_id ? String(contact.zcrm_account_id) : null,
    zcrmContactId: contact.zcrm_contact_id ? String(contact.zcrm_contact_id) : null,
    contactPersonCount: Array.isArray(contact.contact_persons) ? contact.contact_persons.length : 0,
    billingState: billingState.trim() && !/^null$/i.test(billingState.trim()) ? billingState.trim() : null,
    billingZip: billingZip.trim() && !/^null$/i.test(billingZip.trim()) ? billingZip.trim() : null,
  };
}

/**
 * Search Zoho Books customers by name. Exact name match only — a fuzzy
 * first-result fallback used to attach estimates to the wrong customer
 * (and to an unlinked one, for brand-new names).
 *
 * IMPORTANT: Zoho's /contacts endpoint silently drops search_text when
 * contact_type is also present in the same query (confirmed via direct
 * API testing). Search by name only, then filter to customers client-side.
 */
export async function searchBooksCustomer(orgId: string, name: string): Promise<{ id: string; name: string } | null> {
  const found = await findBooksCustomerByName(orgId, name);
  return found ? { id: found.id, name: found.name } : null;
}

export async function getBooksCustomer(orgId: string, customerId: string): Promise<BooksCustomerRecord | null> {
  const result = await booksApiCall("GET", `/contacts/${encodeURIComponent(customerId)}`, orgId) as {
    contact?: {
      contact_id?: string | number;
      contact_name?: string;
      contact_type?: string;
      zcrm_account_id?: string | number | null;
      zcrm_contact_id?: string | number | null;
      contact_persons?: unknown[];
      billing_address?: { state?: string | null; state_code?: string | null; zip?: string | number | null };
    };
  };
  return asBooksCustomer(result?.contact);
}

async function listBooksCustomers(orgId: string, query: string): Promise<BooksCustomerRecord[]> {
  const result = await booksApiCall("GET", query, orgId) as {
    contacts?: {
      contact_id?: string | number;
      contact_name?: string;
      contact_type?: string;
      zcrm_account_id?: string | number | null;
      zcrm_contact_id?: string | number | null;
    }[];
  };
  return (result?.contacts ?? []).map((c) => asBooksCustomer(c)).filter((c): c is BooksCustomerRecord => !!c);
}

/**
 * Find the Books customer Zoho created by importing this CRM account.
 * The list filter is not always honored, so a hit is only trusted when
 * the row actually carries this zcrm_account_id (or the single returned
 * row's full record does).
 */
export async function findBooksCustomerByCrmAccount(orgId: string, accountId: string): Promise<BooksCustomerRecord | null> {
  const rows = await listBooksCustomers(orgId, `/contacts?zcrm_account_id=${encodeURIComponent(accountId)}&per_page=50`);
  const tagged = rows.find((row) => row.zcrmAccountId === String(accountId));
  if (tagged) return tagged;
  if (rows.length === 1) {
    const detail = await getBooksCustomer(orgId, rows[0].id);
    if (detail?.zcrmAccountId === String(accountId)) return detail;
  }
  return null;
}

export async function findBooksCustomerByCrmContact(orgId: string, contactId: string): Promise<BooksCustomerRecord | null> {
  const rows = await listBooksCustomers(orgId, `/contacts?zcrm_contact_id=${encodeURIComponent(contactId)}&per_page=50`);
  const tagged = rows.find((row) => row.zcrmContactId === String(contactId));
  if (tagged) return tagged;
  if (rows.length === 1) {
    const detail = await getBooksCustomer(orgId, rows[0].id);
    if (detail?.zcrmContactId === String(contactId)) return detail;
  }
  return null;
}

export async function findBooksCustomerByName(orgId: string, name: string): Promise<BooksCustomerRecord | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const rows = await listBooksCustomers(orgId, `/contacts?search_text=${encodeURIComponent(name.trim())}`);
  const exact = rows.find((row) => row.name.trim().toLowerCase() === wanted);
  if (!exact) return null;
  return (await getBooksCustomer(orgId, exact.id)) || exact;
}

function readImportContactId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const code = record.code;
  if (typeof code === "number" && code !== 0) {
    throw new Error(`Zoho Books CRM import failed: ${JSON.stringify(record)}`);
  }
  const nested = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : undefined;
  const contact = record.contact && typeof record.contact === "object" ? record.contact as Record<string, unknown> : undefined;
  const raw = nested?.contact_id ?? nested?.customer_id ?? contact?.contact_id ?? record.contact_id;
  if (raw == null || raw === "") return null;
  return String(raw);
}

/**
 * Import a CRM account as a Books customer. This is the call that sets
 * zcrm_account_id, which is what makes later estimates show on the
 * Opportunity. Safe to call for an account that was already imported —
 * callers treat a failure as "look up the existing customer".
 */
export async function importBooksCustomerFromCrmAccount(orgId: string, crmAccountId: string): Promise<string> {
  const result = await booksApiCall("POST", `/crm/account/${encodeURIComponent(crmAccountId)}/import`, orgId);
  const id = readImportContactId(result);
  if (!id) throw new Error("Zoho Books did not return a customer id when importing the CRM account.");
  return id;
}

/** Import a CRM contact. Only succeeds for Contacts-only Books sync. */
export async function importBooksCustomerFromCrmContact(orgId: string, crmContactId: string): Promise<string> {
  const result = await booksApiCall("POST", `/crm/contact/${encodeURIComponent(crmContactId)}/import`, orgId);
  const id = readImportContactId(result);
  if (!id) throw new Error("Zoho Books did not return a customer id when importing the CRM contact.");
  return id;
}

export function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "Customer" };
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export interface BooksCustomerWrite {
  contactName: string;
  companyName?: string;
  contactPersonName?: string;
  email?: string;
  phone?: string;
  billingAddress?: { address?: string; city?: string; state?: string; zip?: string };
  shippingAddress?: { address?: string; city?: string; state?: string; zip?: string };
}

/**
 * Create a Zoho Books customer. This does NOT link the customer to CRM —
 * prefer importBooksCustomerFromCrmAccount. Used only when import fails,
 * and the estimate response warns that the Finance related list may not
 * show the estimate.
 */
export async function createBooksCustomer(orgId: string, input: BooksCustomerWrite): Promise<string> {
  const payload: Record<string, unknown> = {
    contact_name: input.companyName || input.contactName,
    contact_type: "customer",
  };
  if (input.companyName) payload.company_name = input.companyName;
  if (input.email) payload.email = input.email;
  if (input.phone) payload.phone = input.phone;
  const billing = input.billingAddress ? toBooksAddress(input.billingAddress) : undefined;
  const shipping = input.shippingAddress ? toBooksAddress(input.shippingAddress) : undefined;
  if (billing) payload.billing_address = billing;
  if (shipping) payload.shipping_address = shipping;

  // A company customer uses the contact person; a residential customer
  // is the person. Skip when we only have a business name.
  const personName = input.contactPersonName || (input.companyName ? "" : input.contactName);
  if (personName.trim()) {
    const person = splitPersonName(personName);
    const contactPerson: Record<string, unknown> = {
      last_name: person.lastName,
      is_primary_contact: true,
    };
    if (person.firstName) contactPerson.first_name = person.firstName;
    if (input.email) contactPerson.email = input.email;
    if (input.phone) contactPerson.phone = input.phone;
    payload.contact_persons = [contactPerson];
  }

  const result = await booksApiCall("POST", "/contacts", orgId, payload) as { contact?: { contact_id?: string } };
  const id = result?.contact?.contact_id;
  if (!id) throw new Error("Failed to create Books customer: no ID returned");
  return id;
}

/** Write billing/shipping after a CRM import, which copies the CRM address as-is. */
export async function updateBooksCustomerAddress(orgId: string, customerId: string, input: {
  billingAddress?: BooksCustomerWrite["billingAddress"];
  shippingAddress?: BooksCustomerWrite["shippingAddress"];
}): Promise<void> {
  const payload: Record<string, unknown> = {};
  const billing = input.billingAddress ? toBooksAddress(input.billingAddress) : undefined;
  const shipping = input.shippingAddress ? toBooksAddress(input.shippingAddress) : undefined;
  if (billing) payload.billing_address = billing;
  if (shipping) payload.shipping_address = shipping;
  if (!Object.keys(payload).length) return;
  await booksApiCall("PUT", `/contacts/${encodeURIComponent(customerId)}`, orgId, payload);
}

/**
 * CRM import usually brings contact persons along. If it didn't (the
 * contact was created seconds earlier), add the person so the Books
 * customer isn't a bare company with nobody on it.
 */
export async function ensureBooksContactPerson(orgId: string, customerId: string, person: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<void> {
  const detail = await getBooksCustomer(orgId, customerId);
  if (detail && detail.contactPersonCount > 0) return;
  const split = splitPersonName(person.name);
  if (!split.lastName) return;
  const payload: Record<string, unknown> = {
    contact_id: customerId,
    last_name: split.lastName,
    is_primary_contact: true,
  };
  if (split.firstName) payload.first_name = split.firstName;
  if (person.email) payload.email = person.email;
  if (person.phone) payload.phone = person.phone;
  await booksApiCall("POST", "/contacts/contactpersons", orgId, payload);
}

export function booksCustomerLinkClient(orgId: string, fallback: BooksCustomerWrite): BooksCustomerLinkClient {
  return {
    importAccount: (accountId) => importBooksCustomerFromCrmAccount(orgId, accountId),
    importContact: (contactId) => importBooksCustomerFromCrmContact(orgId, contactId),
    findByAccountId: (accountId) => findBooksCustomerByCrmAccount(orgId, accountId),
    findByContactId: (contactId) => findBooksCustomerByCrmContact(orgId, contactId),
    findByName: (name) => findBooksCustomerByName(orgId, name),
    createUnlinked: () => createBooksCustomer(orgId, fallback),
  };
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
  /** Flat entity-level discount. Line rates stay non-negative. */
  discountAmount?: number;
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
  if (input.discountAmount && input.discountAmount > 0) {
    payload.discount = input.discountAmount;
    payload.discount_type = "entity_level";
    payload.is_discount_before_tax = true;
  }

  const installationAddressLines = formatInstallationAddress({
    street: input.installationStreet,
    city: input.installationCity,
    state: input.installationState,
    zip: input.installationZip,
  });
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
