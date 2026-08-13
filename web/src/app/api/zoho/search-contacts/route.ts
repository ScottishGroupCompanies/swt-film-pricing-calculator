/**
 * GET /api/zoho/search-contacts?q=jenny
 *
 * Searches Zoho CRM Contacts by fuzzy name/email/phone match. Used by the
 * calculator's "search previous contacts" autofill picker so reps can pull
 * in an existing prospect's info instead of re-typing it.
 *
 * When a matched Contact is linked to a real Zoho Account (i.e. it's a
 * Commercial client), the Account's own business name/address/phone/email
 * are fetched and returned too — so selecting an existing commercial
 * contact fills out the full Business + Contact Person split, not just
 * the person's own fields.
 *
 * Returns: { success, contacts: [{
 *   id, name, email, phone, address, cityStateZip,
 *   isCommercial, accountId, companyName, companyAddress,
 *   companyCityStateZip, companyPhone, companyEmail,
 * }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { searchContactsFuzzy, getRecord, type ZohoCRMRecord } from "@/lib/zoho";

function splitCityStateZip(city: string, state: string, zip: string): string {
  return ([city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "")).trim();
}

async function formatContact(c: ZohoCRMRecord) {
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

  const base = {
    id: c.id as string,
    name,
    email: (c.Email as string) || "",
    phone: (c.Phone as string) || (c.Mobile as string) || "",
    address: (c.Mailing_Street as string) || "",
    cityStateZip,
    isCommercial: false,
    accountId,
    companyName: "",
    companyAddress: "",
    companyCityStateZip: "",
    companyPhone: "",
    companyEmail: "",
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

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";

    if (q.trim().length < 2) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const contacts = await searchContactsFuzzy(q, 10);
    const formatted = await Promise.all(contacts.map(formatContact));

    return NextResponse.json({
      success: true,
      contacts: formatted,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal server error", contacts: [] },
      { status: 500 }
    );
  }
}
