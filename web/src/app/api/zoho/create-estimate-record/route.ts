/**
 * POST /api/zoho/create-estimate-record
 *
 * Creates the real Estimate in Zoho Books (the product that actually
 * powers the itemized "Fill Out Estimate" page shown under "Zoho
 * Finance" on the Opportunity), linked back to the CRM Deal via
 * zcrm_potential_id. Zoho's built-in CRM↔Books sync then surfaces a
 * summary record on the Opportunity's Estimates related list
 * automatically — no separate CRM write needed.
 *
 * Requires the Deal to already exist (rep must have clicked "Send to
 * Zoho Opportunities" first) so we have a real Opportunity to link
 * against, and a Books customer that corresponds to the CRM Contact/
 * Account (synced automatically by Zoho, or created here as a fallback).
 *
 * Every Books estimate line item must reference a real Item record —
 * this endpoint maps each line's film category to one of the existing
 * catalog items (Frost/Privacy Film, Security Film, Solar Film,
 * Graffiti, Other Film) and falls back to "Other Film" for anything
 * unrecognized. The 4% fee always maps to "Fee (No Tax)", matching the
 * exact item name/description already used on real production estimates.
 *
 * NOTE: this endpoint is fully built but requires ZOHO_BOOKS_ORG_ID to
 * be set (find it via GET /books/v3/organizations — see
 * web/docs/ZOHO-SETUP.md "Connecting to Production Zoho — Books" section).
 * Until then it returns a clear "not configured" response.
 *
 * Returns: { success, estimateId, estimateNumber, estimateUrl, error? }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getBooksConfig, searchBooksCustomer, createBooksCustomer,
  searchBooksItem, createBooksEstimate, findSyncedCrmEstimateRecord,
  parseCityStateZip,
  type BooksEstimateLineItem,
} from "@/lib/zoho";

interface EstimateLine {
  desc: string;
  dims: string;
  qty: number;
  film: string;
  brand?: string;
  lineTotal: number;
}

interface CreateEstimateRequest {
  dealId: string;
  opportunityNumber?: string | null; // Zoho's native Opportunity Number (e.g. "WT-03296") — required to derive estimate_number
  contactId?: string | null;
  customer: string;
  address?: string;
  cityStateZip?: string;
  phone?: string;
  email?: string;
  date: string; // display format e.g. "8/4/2026"
  jobType?: "Residential" | "Commercial";
  companyName?: string;
  companyAddress?: string;
  companyCityStateZip?: string;
  companyPhone?: string;
  companyEmail?: string;
  userName?: string;
  feeAmount?: number;
  feePct?: number;
  lines: EstimateLine[];
}

// Maps a film name/brand to one of the real Zoho Books catalog item names.
// Falls back to "Other Film" for anything unrecognized — safe default,
// never blocks estimate creation.
function mapFilmToBooksItemName(film: string): string {
  const f = (film || "").toLowerCase();
  if (f.includes("frost") || f.includes("privacy") || f.includes("mist") || f.includes("glacier")) return "Frost/Privacy Film";
  if (f.includes("safety") || f.includes("security") || f.includes("s2400") || f.includes("prestige")) return "Security Film";
  if (f.includes("solar") || f.includes("reflect") || f.includes("neutral") || f.includes("ceramic")) return "Solar Film";
  if (f.includes("graffiti") || f.includes("anti graffiti")) return "Graffiti";
  if (f.includes("bird")) return "Bird Film";
  return "Other Film";
}

function parseDateForBooks(displayDate: string): string {
  // Accepts common browser toLocaleDateString formats (e.g. "8/4/2026")
  // and normalizes to Books' required YYYY-MM-DD.
  const d = new Date(displayDate);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Address parsing lives in @/lib/zoho now (parseCityStateZip) — shared with
// submit-pricing/route.ts so both use the same tolerant parser (handles
// missing commas, full state names, etc. instead of silently returning
// blank fields that render as "null null null" on the Books estimate).

export async function POST(request: NextRequest) {
  try {
    const body: CreateEstimateRequest = await request.json();

    if (!body.dealId) {
      return NextResponse.json(
        { success: false, error: "No Deal ID provided — send to Zoho Opportunities first, then fill out the estimate." },
        { status: 400 }
      );
    }
    if (!body.opportunityNumber) {
      return NextResponse.json(
        { success: false, error: "No Opportunity Number available yet — wait for Zoho to assign one after sending to Zoho Opportunities." },
        { status: 400 }
      );
    }
    if (!body.lines?.length) {
      return NextResponse.json(
        { success: false, error: "No line items to add to the estimate." },
        { status: 400 }
      );
    }

    const booksConfig = getBooksConfig();
    if (!booksConfig) {
      return NextResponse.json(
        {
          success: false,
          error: "Zoho Books isn't connected yet. This feature is fully built — it just needs ZOHO_BOOKS_ORG_ID set once production Zoho Books access is confirmed. See web/docs/ZOHO-SETUP.md.",
          notConfigured: true,
        },
        { status: 501 }
      );
    }

    const { orgId } = booksConfig;
    const isCommercial = body.jobType === "Commercial";
    const accountOrCustomerName = isCommercial && body.companyName
      ? body.companyName
      : body.customer;

    // ── 1. Resolve the Books customer (sync from CRM usually already
    //       created one; create a fallback if not found yet) ──────────
    let customerId: string;
    const existingCustomer = await searchBooksCustomer(orgId, accountOrCustomerName);
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Commercial: bill to the business's own address/phone/email.
      // Residential: bill to the customer's job-site info.
      const billingCsz = isCommercial ? body.companyCityStateZip : body.cityStateZip;
      const { city, state, zip } = parseCityStateZip(billingCsz);
      customerId = await createBooksCustomer(orgId, {
        contactName: body.customer,
        companyName: isCommercial ? body.companyName : undefined,
        email: isCommercial ? body.companyEmail || body.email : body.email,
        phone: isCommercial ? body.companyPhone || body.phone : body.phone,
        billingAddress: {
          address: isCommercial ? body.companyAddress || body.address : body.address,
          city, state, zip,
        },
      });
    }

    // ── 2. Map each line item's film to a real Books Item, resolve rate ─
    const lineItems: BooksEstimateLineItem[] = [];
    const unmatchedFilms: string[] = [];

    for (const line of body.lines) {
      const itemName = mapFilmToBooksItemName(line.film);
      const item = await searchBooksItem(orgId, itemName)
        || await searchBooksItem(orgId, "Other Film");
      if (!item) {
        unmatchedFilms.push(line.film || "Unknown film");
        continue;
      }
      const filmLabel = line.film && line.film !== "—" ? line.film : "Window Film";
      lineItems.push({
        itemId: item.id,
        name: item.name,
        description: `${line.desc || filmLabel} (qty ${line.qty})${line.film && line.film !== "—" ? ` · ${line.film}` : ""}`,
        rate: line.qty ? line.lineTotal / line.qty : line.lineTotal,
        quantity: line.qty || 1,
      });
    }

    // ── 3. Add the fee line item, matching production's exact wording ──
    if (body.feeAmount != null && body.feeAmount > 0) {
      const feeItem = await searchBooksItem(orgId, "Fee (No Tax)") || await searchBooksItem(orgId, "Fee");
      if (feeItem) {
        lineItems.push({
          itemId: feeItem.id,
          name: feeItem.name,
          description: `${body.feePct ?? 4}% fee includes shipping, handling, delivery, and energy surcharge.`,
          rate: body.feeAmount,
          quantity: 1,
        });
      }
    }

    if (!lineItems.length) {
      return NextResponse.json(
        { success: false, error: `Could not match any line items to Zoho Books catalog items. Unmatched films: ${unmatchedFilms.join(", ")}` },
        { status: 500 }
      );
    }

    // ── 4. Create the Estimate in Books, linked to the CRM Deal ────────
    // Installation address = the job-site address the rep typed into the
    // calculator (same field used for Installation_Street/City/State/Zip
    // on the Deal in submit-pricing/route.ts) — populates Books' own
    // "Installation Address" custom field so it's never blank/"null null
    // null" on the generated estimate.
    const { city: installCity, state: installState, zip: installZip } = parseCityStateZip(body.cityStateZip);
    const result = await createBooksEstimate(orgId, {
      customerId,
      dealId: body.dealId,
      opportunityNumber: body.opportunityNumber,
      estimateDate: parseDateForBooks(body.date),
      salespersonName: body.userName,
      lineItems,
      installationStreet: body.address,
      installationCity: installCity,
      installationState: installState,
      installationZip: installZip,
    });

    // ── 5. Wait for Zoho's CRM↔Books sync to create the matching
    //       CustomModule5002 record, then build a direct link to THAT
    //       record — this is the specific page Jenny needs to land on
    //       (.../tab/CustomModule5002/<crm record id>), not the standalone
    //       Books estimate page.
    const crmRecordId = await findSyncedCrmEstimateRecord(body.dealId, result.estimateNumber);

    const orgUrl = process.env.ZOHO_ORG_URL || "https://one.zoho.com/zohoone/scottishwindowtinting/home/cxapp/crm/org848141664";
    const estimateUrl = crmRecordId && orgUrl
      ? `${orgUrl}/tab/CustomModule5002/${crmRecordId}`
      : null;

    return NextResponse.json({
      success: true,
      estimateId: result.estimateId,
      estimateNumber: result.estimateNumber,
      crmRecordId,
      estimateUrl,
      syncPending: !crmRecordId,
      unmatchedFilms: unmatchedFilms.length ? unmatchedFilms : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
