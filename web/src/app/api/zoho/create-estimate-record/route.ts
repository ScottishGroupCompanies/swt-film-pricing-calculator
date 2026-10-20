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
 * against, and a Books customer imported from that Deal's CRM account
 * (POST /crm/account/{id}/import). A name lookup that misses and then
 * POST /contacts creates an unlinked customer, which is why estimates
 * for brand-new customers never showed under Zoho Finance > Estimates.
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
import { parseCityStateZip } from "@/lib/address";
import { planEstimateLines } from "@/lib/estimateLines";
import { resolveBooksCustomerLink } from "@/lib/booksCustomerLink";
import {
  getBooksConfig, getRecord, getBooksCustomer, searchBooksItem, createBooksEstimate,
  findSyncedCrmEstimateRecord, booksCustomerLinkClient, updateBooksCustomerAddress,
  ensureBooksContactPerson, findBooksSalespersonByEmail,
  type BooksEstimateLineItem,
} from "@/lib/zoho";
import { getSessionUserId } from "@/lib/sessionCookies";
import { findUserById } from "@/lib/auth";
import { booksSalespersonIdEnvKey, readEnvUserOverride } from "@/lib/zohoOwners";

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
  accountId?: string | null;
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
  contactPersonName?: string;
  feeAmount?: number;
  feePct?: number;
  /** Film total after the $250 minimum, before the fee. */
  minAdj?: number;
  /** Calculator total (minimum, discount, other, plus fee) — the deal amount. */
  totalCost?: number;
  lines: EstimateLine[];
}

function parseDateForBooks(displayDate: string): string {
  // Accepts common browser toLocaleDateString formats (e.g. "8/4/2026")
  // and normalizes to Books' required YYYY-MM-DD.
  const d = new Date(displayDate);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Address parsing lives in @/lib/address (parseCityStateZip) — shared with
// submit-pricing so both accept "centennial co 80112" and never send the
// literal word "null" to Books.

function lookupId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

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

    // The Deal is the source of truth for which CRM account this estimate
    // has to be billed to. The ids submit-pricing returned are the fallback
    // when the Deal read fails.
    let accountId = body.accountId || null;
    let contactId = body.contactId || null;
    try {
      const deal = await getRecord("Deals", body.dealId);
      accountId = lookupId(deal?.Account_Name) || accountId;
      contactId = lookupId(deal?.Contact_Name) || contactId;
    } catch {
      // Keep the client-supplied ids.
    }

    const billingCsz = isCommercial ? body.companyCityStateZip : body.cityStateZip;
    const billingParsed = parseCityStateZip(billingCsz);
    const installParsed = parseCityStateZip(body.cityStateZip);
    const billingAddress = {
      address: isCommercial ? body.companyAddress || body.address : body.address,
      city: billingParsed.city,
      state: billingParsed.state,
      zip: billingParsed.zip,
    };
    const shippingAddress = {
      address: body.address,
      city: installParsed.city,
      state: installParsed.state,
      zip: installParsed.zip,
    };
    const personName = (isCommercial ? body.contactPersonName : "") || body.customer;
    const personEmail = isCommercial ? body.companyEmail || body.email : body.email;
    const personPhone = isCommercial ? body.companyPhone || body.phone : body.phone;

    // ── 1. Import the CRM account (or contact) as the Books customer.
    //       Creating one by name leaves zcrm_account_id empty, and the
    //       estimate then never appears on the Opportunity. ──────────
    const warnings: string[] = [];
    const linked = await resolveBooksCustomerLink(
      booksCustomerLinkClient(orgId, {
        contactName: body.customer,
        companyName: isCommercial ? body.companyName : undefined,
        contactPersonName: personName,
        email: personEmail,
        phone: personPhone,
        billingAddress,
        shippingAddress,
      }),
      { accountId, contactId, customerName: accountOrCustomerName }
    );
    const customerId = linked.customerId;
    if (linked.warning) warnings.push(linked.warning);

    // Import copies the CRM account address, which on a brand-new
    // residential account is often just the city — Books then prints
    // "Centennial null null". Fill state/ZIP only when they're blank so a
    // repeat customer's existing billing address is left alone.
    let booksCustomer: Awaited<ReturnType<typeof getBooksCustomer>> = null;
    try {
      booksCustomer = await getBooksCustomer(orgId, customerId);
    } catch {
      booksCustomer = null;
    }
    if (!booksCustomer?.billingState || !booksCustomer?.billingZip) {
      try {
        await updateBooksCustomerAddress(orgId, customerId, { billingAddress, shippingAddress });
      } catch (e) {
        warnings.push(
          `Billing address could not be saved on the Zoho Books customer (${e instanceof Error ? e.message : String(e)}). City, state, and ZIP may be blank.`
        );
      }
    }
    if (personName?.trim()) {
      try {
        await ensureBooksContactPerson(orgId, customerId, {
          name: personName,
          email: personEmail,
          phone: personPhone,
        });
      } catch {
        // A missing contact person doesn't block the estimate. The CRM
        // link above is what puts it on the Opportunity.
      }
    }

    // ── 2. Map each planned line (film, minimum adjustment, fee) to a
    //       real Books item. The minimum line uses the film item so it
    //       stays on the same tax treatment as the windows. ───────────
    const planned = planEstimateLines({
      lines: body.lines,
      minAdj: body.minAdj,
      feeAmount: body.feeAmount,
      feePct: body.feePct,
      totalCost: body.totalCost,
    });
    const lineItems: BooksEstimateLineItem[] = [];
    const unmatchedFilms: string[] = [];
    let filmItem: { id: string; name: string } | null = null;

    for (const line of planned.lines) {
      if (line.kind === "fee") {
        const feeItem = await searchBooksItem(orgId, "Fee (No Tax)") || await searchBooksItem(orgId, "Fee");
        if (!feeItem) continue;
        lineItems.push({
          itemId: feeItem.id,
          name: feeItem.name,
          description: line.description,
          rate: line.rate,
          quantity: line.quantity,
        });
        continue;
      }

      if (line.kind === "film") {
        const item = await searchBooksItem(orgId, line.itemName) || await searchBooksItem(orgId, "Other Film");
        if (!item) {
          unmatchedFilms.push(line.description || "Unknown film");
          continue;
        }
        if (!filmItem) filmItem = item;
        lineItems.push({
          itemId: item.id,
          name: item.name,
          description: line.description,
          rate: line.rate,
          quantity: line.quantity,
        });
        continue;
      }

      const item = filmItem || await searchBooksItem(orgId, "Other Film");
      if (!item) continue;
      lineItems.push({
        itemId: item.id,
        name: line.name,
        description: line.description,
        rate: line.rate,
        quantity: line.quantity,
      });
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
    // Salesperson follows the logged-in user. Katie is matched to the Books
    // salesperson with her CRM email (or ZOHO_BOOKS_SALESPERSON_ID_KATIE).
    // Other reps keep the previous behavior: the estimate is labeled with
    // their display name.
    const sessionUserId = await getSessionUserId();
    const sessionUser = sessionUserId ? findUserById(sessionUserId) : null;
    let salespersonName = sessionUser?.name || body.userName;
    let salespersonId: string | undefined;
    if (sessionUser) {
      const envSalespersonId = readEnvUserOverride(sessionUser.id, process.env, "ZOHO_BOOKS_SALESPERSON_ID");
      if (envSalespersonId) {
        salespersonId = envSalespersonId;
      } else if (sessionUser.zohoEmail) {
        try {
          const salesperson = await findBooksSalespersonByEmail(orgId, sessionUser.zohoEmail);
          if (salesperson) {
            salespersonId = salesperson.id;
            if (salesperson.name) salespersonName = salesperson.name;
          } else {
            warnings.push(
              `No Zoho Books salesperson matches ${sessionUser.zohoEmail}. The estimate uses the name "${salespersonName}". Add that email as a Books salesperson, or set ${booksSalespersonIdEnvKey(sessionUser.id)} to her salesperson id.`,
            );
          }
        } catch (e) {
          warnings.push(
            `Could not look up the Zoho Books salesperson for ${sessionUser.zohoEmail} (${e instanceof Error ? e.message : String(e)}). The estimate uses the name "${salespersonName}". Set ${booksSalespersonIdEnvKey(sessionUser.id)} to assign her salesperson record.`,
          );
        }
      }
    }

    const result = await createBooksEstimate(orgId, {
      customerId,
      dealId: body.dealId,
      opportunityNumber: body.opportunityNumber,
      estimateDate: parseDateForBooks(body.date),
      salespersonName,
      salespersonId,
      lineItems,
      installationStreet: body.address,
      installationCity: installParsed.city,
      installationState: installParsed.state,
      installationZip: installParsed.zip,
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
      customerLinked: linked.linked,
      linkWarning: linked.warning,
      warnings: warnings.length ? warnings : undefined,
      unmatchedFilms: unmatchedFilms.length ? unmatchedFilms : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
