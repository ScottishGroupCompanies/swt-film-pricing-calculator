/**
 * GET /api/zoho/search-contacts?q=jenny
 *
 * Unified fuzzy search across BOTH Zoho CRM Contacts and Deals
 * (Opportunities), so the "search previous jobs" picker can pull in either
 * a person's saved info OR re-open a specific existing job and get its
 * real installation address back (which lives on the Deal itself —
 * Installation_Street/City/State/Zip — not on the Contact record).
 *
 * Contacts give: mailing address, and (if linked to a real Commercial
 * Account) the business's own name/address/phone/email.
 * Deals give: the job's real installation address, Opportunity Number,
 * and the linked Contact/Account name for display.
 *
 * Returns: { success, results: [{
 *   type: "contact" | "deal",
 *   id, dealId, opportunityNumber, name, email, phone,
 *   address, cityStateZip, installationAddress, installationCityStateZip,
 *   isCommercial, accountId, companyName, companyAddress,
 *   companyCityStateZip, companyPhone, companyEmail,
 * }] }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  searchContactsFuzzy, searchDealsFuzzy, searchLeadsFuzzy, searchAccountsFuzzy,
  getRecord, type ZohoCRMRecord,
} from "@/lib/zoho";

function splitCityStateZip(city: string, state: string, zip: string): string {
  const cleanZip = zip && zip !== "-" ? zip : "";
  return ([city, state].filter(Boolean).join(", ") + (cleanZip ? ` ${cleanZip}` : "")).trim();
}

interface SearchResult {
  type: "contact" | "deal" | "lead" | "account";
  id: string;
  dealId: string | null;
  opportunityNumber: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  cityStateZip: string;
  installationAddress: string;
  installationCityStateZip: string;
  isCommercial: boolean;
  accountId: string | null;
  companyName: string;
  companyAddress: string;
  companyCityStateZip: string;
  companyPhone: string;
  companyEmail: string;
  leadStatus: string | null;
}


async function formatContact(c: ZohoCRMRecord): Promise<SearchResult> {
  const firstName = (c.First_Name as string) || "";
  const lastName = (c.Last_Name as string) || "";
  const name = `${firstName} ${lastName}`.trim() || "—";

  const cityStateZip = splitCityStateZip(
    (c.Mailing_City as string) || "",
    (c.Mailing_State as string) || "",
    (c.Mailing_Zip as string) || ""
  );

  const accountLookup = c.Account_Name as { id?: string; name?: string } | null;
  const accountId = accountLookup?.id || null;

  const base: SearchResult = {
    type: "contact",
    id: c.id as string,
    dealId: null,
    opportunityNumber: null,
    name,
    email: (c.Email as string) || "",
    phone: (c.Phone as string) || (c.Mobile as string) || "",
    address: (c.Mailing_Street as string) || "",
    cityStateZip,
    installationAddress: "",
    installationCityStateZip: "",
    isCommercial: false,
    accountId,
    companyName: "",
    companyAddress: "",
    companyCityStateZip: "",
    companyPhone: "",
    companyEmail: "",
    leadStatus: null,
  };

  if (!accountId) return base;

  // Fetch the linked Account's own business info. Every Contact has an
  // Account_Name lookup (Zoho auto-creates one using the person's own
  // name for plain Residential customers too) — so existence alone
  // doesn't mean "Commercial". Only treat it as a business when the
  // Account's own Account_Type field is actually set to "Commercial".
  try {
    const account = await getRecord("Accounts", accountId);
    if (!account) return base;
    const isCommercial = account.Account_Type === "Commercial";
    if (!isCommercial) return base;
    return {
      ...base,
      isCommercial: true,
      companyName: (account.Account_Name as string) || base.companyName,
      companyAddress: (account.Billing_Street as string) || "",
      companyCityStateZip: splitCityStateZip(
        (account.Billing_City as string) || "",
        (account.Billing_State1 as string) || "",
        (account.Billing_Code as string) || ""
      ),
      companyPhone: (account.Phone as string) || "",
      companyEmail: (account.Email as string) || "",
    };
  } catch {
    // If the Account fetch fails for any reason, still return the Contact's
    // own info rather than failing the whole search.
    return base;
  }
}

function formatDeal(d: ZohoCRMRecord): SearchResult {
  const contactLookup = d.Contact_Name as { id?: string; name?: string } | null;
  const accountLookup = d.Account_Name as { id?: string; name?: string } | null;
  const displayName = contactLookup?.name || accountLookup?.name || (d.Deal_Name as string) || "—";

  const installationCityStateZip = splitCityStateZip(
    (d.Installation_City as string) || "",
    (d.Installation_State as string) || "",
    (d.Installation_Zip as string) || ""
  );

  return {
    type: "deal",
    id: (contactLookup?.id as string) || (d.id as string),
    dealId: d.id as string,
    opportunityNumber: (d.Opportunity_Number as string) || null,
    name: displayName,
    email: "",
    phone: "",
    address: "",
    cityStateZip: "",
    installationAddress: (d.Installation_Street as string) || "",
    installationCityStateZip,
    isCommercial: d.Type === "Commercial" || !!accountLookup,
    accountId: accountLookup?.id || null,
    companyName: accountLookup?.name || "",
    companyAddress: "",
    companyCityStateZip: "",
    companyPhone: "",
    companyEmail: "",
    leadStatus: null,
  };
}

function formatLead(l: ZohoCRMRecord): SearchResult {
  const name = (l.Full_Name as string)
    || `${(l.First_Name as string) || ""} ${(l.Last_Name as string) || ""}`.trim()
    || "—";
  const cityStateZip = splitCityStateZip(
    (l.City as string) || "",
    (l.State as string) || "",
    (l.Zip_Code as string) || ""
  );

  return {
    type: "lead",
    id: l.id as string,
    dealId: null,
    opportunityNumber: null,
    name,
    email: (l.Email as string) || "",
    phone: (l.Phone as string) || (l.Mobile as string) || "",
    address: (l.Street as string) || "",
    cityStateZip,
    installationAddress: "",
    installationCityStateZip: "",
    isCommercial: !!(l.Company && l.Company !== name),
    accountId: null,
    companyName: (l.Company as string) || "",
    companyAddress: (l.Street as string) || "",
    companyCityStateZip: cityStateZip,
    companyPhone: (l.Phone as string) || "",
    companyEmail: (l.Email as string) || "",
    leadStatus: (l.Lead_Status as string) || null,
  };
}

function formatAccount(a: ZohoCRMRecord): SearchResult {
  const companyCityStateZip = splitCityStateZip(
    (a.Billing_City as string) || "",
    (a.Billing_State1 as string) || "",
    (a.Billing_Code as string) || ""
  );

  return {
    type: "account",
    id: a.id as string,
    dealId: null,
    opportunityNumber: null,
    name: (a.Account_Name as string) || "—",
    email: (a.Email as string) || "",
    phone: (a.Phone as string) || "",
    address: "",
    cityStateZip: "",
    installationAddress: "",
    installationCityStateZip: "",
    isCommercial: a.Account_Type === "Commercial",
    accountId: a.id as string,
    companyName: (a.Account_Name as string) || "",
    companyAddress: (a.Billing_Street as string) || "",
    companyCityStateZip,
    companyPhone: (a.Phone as string) || "",
    companyEmail: (a.Email as string) || "",
    leadStatus: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";

    if (q.trim().length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const [contacts, deals, leads, accounts] = await Promise.all([
      searchContactsFuzzy(q, 6),
      searchDealsFuzzy(q, 6),
      searchLeadsFuzzy(q, 6),
      searchAccountsFuzzy(q, 6),
    ]);

    const [formattedContacts, formattedDeals, formattedLeads, formattedAccounts] = await Promise.all([
      Promise.all(contacts.map(formatContact)),
      Promise.resolve(deals.map(formatDeal)),
      Promise.resolve(leads.map(formatLead)),
      Promise.resolve(accounts.map(formatAccount)),
    ]);

    // Deals first — reopening a specific existing job (with its real
    // installation address) is usually what a rep searching by customer
    // name is trying to do, ahead of a bare contact-only match. Then
    // Accounts (real businesses), then Contacts, then Leads (least
    // "ready" — no Deal/Account exists for these yet).
    const results = [...formattedDeals, ...formattedAccounts, ...formattedContacts, ...formattedLeads];

    return NextResponse.json({ success: true, results });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal server error", results: [] },
      { status: 500 }
    );
  }
}
