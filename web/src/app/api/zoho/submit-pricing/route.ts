/**
 * POST /api/zoho/submit-pricing
 * 
 * Receives pricing data from the calculator, then:
 * 1. Creates or finds a Contact in Zoho CRM
 * 2. Creates a Deal (Opportunity) linked to that contact
 * 3. Adds a note with full pricing breakdown
 * 4. Appends a row to Zoho Sheet with line-item data
 * 
 * Returns: { success, contactId, dealId, sheetRowAdded, errors[] }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  searchContact, createContact, searchAccount, createAccount, createDeal, addNote, appendSheetRow,
  parseCityStateZip,
} from "@/lib/zoho";
import { getSessionUserId } from "@/lib/sessionCookies";
import { findUserById } from "@/lib/auth";

interface PricingLineItem {
  desc: string;
  dims: string;
  qty: number;
  film: string;
  brand: string;
  pg: number | null;
  psf: number | null;
  rollW: number;
  actualSF: number;
  chargedSF: number;
  wastageSF: number;
  lineTotal: number;
}

interface SubmitPricingRequest {
  customer: string;
  address: string;
  userName: string;
  userLoc: string;
  date: string;
  lines: PricingLineItem[];
  totalActual: number;
  totalCharged: number;
  subtotal: number;
  minAdj: number;
  total: number;
  highestPg: number;
  chargedToClient: number | null;
  difference: number;
  baseCommission: number | null;
  overUnderComm: number;
  totalCommission: number | null;
  commRate: number | null;
  minDim: number;
  // Contact info for CRM (sent by the calculator as cityStateZip/phone/email)
  cityStateZip?: string;
  phone?: string;
  email?: string;
  // Editable post-calculation summary
  discount?: number;
  subtotalAfterDiscount?: number;
  feePct?: number;
  feeAmount?: number;
  totalCost?: number;
  deposit?: number;
  balanceDue?: number;
  // If the rep selected an existing contact via the "search previous
  // contacts" picker, reuse it instead of searching/creating a new one.
  existingContactId?: string | null;
  // Job type + Opportunity naming
  jobType?: "Residential" | "Commercial";
  companyName?: string;
  companyAddress?: string;
  companyCityStateZip?: string;
  companyPhone?: string;
  companyEmail?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  contactBillingAddress?: string;
  contactBillingCityStateZip?: string;
  opportunityName?: string;
}

// Address parsing lives in @/lib/zoho now (parseCityStateZip) — shared with
// create-estimate-record/route.ts so both use the same tolerant parser.

export async function POST(request: NextRequest) {
  try {
    const body: SubmitPricingRequest = await request.json();

    // Validate required fields
    if (!body.customer || !body.userName || !body.total) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: customer, userName, and total are required." },
        { status: 400 }
      );
    }

    const results = {
      success: false,
      contactId: null as string | null,
      accountId: null as string | null,
      dealId: null as string | null,
      opportunityNumber: null as string | null,
      sheetRowAdded: false,
      noteAdded: false,
      errors: [] as string[],
    };

    const isCommercial = body.jobType === "Commercial";

    // ── 1. Resolve Contact in CRM (reuse existing, or find/create) ─────
    try {
      if (body.existingContactId) {
        // Rep selected an existing contact via the search picker — reuse it.
        results.contactId = body.existingContactId;
      } else {
        // For Commercial jobs, the Contact is the specific person (facility
        // manager, etc.), separate from the Account (the business). The
        // "customer" field holds the contact person's name when
        // contactPersonName wasn't separately provided.
        const contactDisplayName = isCommercial && body.contactPersonName
          ? body.contactPersonName
          : body.customer;

        // Try to find existing contact by name
        let contact = await searchContact(contactDisplayName, isCommercial ? body.contactPersonEmail : body.email);

        if (!contact) {
          // Parse contact name into first/last
          const nameParts = contactDisplayName.trim().split(/\s+/);
          const firstName = nameParts.length > 1 ? nameParts[0] : "";
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : contactDisplayName;

          // Commercial: use the contact's own billing address if given,
          // falling back to the job/installation address. Residential:
          // the job address doubles as the mailing address.
          const billingSource = isCommercial && body.contactBillingAddress
            ? { street: body.contactBillingAddress, csz: body.contactBillingCityStateZip }
            : { street: body.address, csz: body.cityStateZip };
          const { city: mailingCity, state: mailingState, zip: mailingZip } = parseCityStateZip(billingSource.csz);

          contact = {
            id: await createContact({
              firstName,
              lastName,
              email: isCommercial ? body.contactPersonEmail || body.email : body.email,
              phone: isCommercial ? body.contactPersonPhone || body.phone : body.phone,
              mailingStreet: billingSource.street,
              mailingCity,
              mailingState,
              mailingZip,
            }),
          };
        }

        results.contactId = (contact.id as string) || null;
      }
    } catch (e) {
      results.errors.push(`Contact creation failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 2. Resolve Account (Commercial only) — the business itself, as a
    //       real Zoho Account record, separate from the Contact. NOTE:
    //       Residential jobs deliberately do NOT get an Account linked —
    //       this matches the original behavior (Contact-only). An
    //       Account-linking experiment for Residential jobs was tried and
    //       then explicitly reverted per Jenny's request.
    if (isCommercial && body.companyName?.trim()) {
      try {
        const companyName = body.companyName.trim();
        const existingAccount = await searchAccount(companyName);
        if (existingAccount?.id) {
          results.accountId = existingAccount.id as string;
        } else {
          const { city, state, zip } = parseCityStateZip(body.companyCityStateZip);
          results.accountId = await createAccount({
            accountName: companyName,
            phone: body.companyPhone,
            email: body.companyEmail,
            billingStreet: body.companyAddress,
            billingCity: city,
            billingState: state,
            billingZip: zip,
          });
        }
      } catch (e) {
        results.errors.push(`Account creation failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── 3. Create Deal (Opportunity) in CRM ───────────────────────────
    try {
      const dealName = body.opportunityName?.trim() || `${body.customer} — Window Film ${body.date}`;
      const dealDescription = buildDealDescription(body);
      const { city: installCity, state: installState, zip: installZip } = parseCityStateZip(body.cityStateZip);

      // Owner = the currently logged-in rep's real Zoho user ID (from their
      // server-side session, never trusted from client input) — makes them
      // the Opportunity Owner in Zoho, as requested.
      const sessionUserId = await getSessionUserId();
      const sessionUser = sessionUserId ? findUserById(sessionUserId) : null;

      const dealResult = await createDeal({
        dealName,
        contactId: results.contactId || undefined,
        accountId: results.accountId || undefined,
        amount: body.chargedToClient || body.totalCost || body.total,
        stage: "Qualification",
        description: dealDescription,
        userName: body.userName,
        ownerZohoUserId: sessionUser?.zohoUserId,
        jobType: body.jobType,
        installationStreet: body.address,
        installationCity: installCity,
        installationState: installState,
        installationZip: installZip,
      });

      results.dealId = dealResult.id;
      results.opportunityNumber = dealResult.opportunityNumber;

      // ── 3a. Add detailed note to the deal ───────────────────────────
      try {
        const noteContent = buildNoteContent(body);
        await addNote(dealResult.id, "Deals", `Pricing Detail — ${body.date}`, noteContent);
        results.noteAdded = true;
      } catch (e) {
        results.errors.push(`Note creation failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } catch (e) {
      results.errors.push(`Deal creation failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 4. Append row to Zoho Sheet ───────────────────────────────────
    try {
      const workbookId = process.env.ZOHO_SHEET_WORKBOOK_ID;
      const worksheetName = process.env.ZOHO_SHEET_WORKSHEET_NAME || "Pricing";

      if (workbookId) {
        const rowData: Record<string, string | number> = {
          Date: body.date,
          Customer: body.customer,
          Address: body.address,
          City_State_Zip: body.cityStateZip || "",
          Phone: body.phone || "",
          Email: body.email || "",
          User: body.userName,
          Location: body.userLoc,
          Total_SqFt_Actual: body.totalActual.toFixed(2),
          Total_SqFt_Charged: body.totalCharged.toFixed(2),
          Subtotal: body.subtotal.toFixed(2),
          Min_Adjustment: body.minAdj.toFixed(2),
          Film_Total: body.total.toFixed(2),
          Discount: body.discount?.toFixed(2) || "",
          Fee_Pct: body.feePct != null ? `${body.feePct}%` : "",
          Fee_Amount: body.feeAmount?.toFixed(2) || "",
          Total_Cost: body.totalCost?.toFixed(2) || body.total.toFixed(2),
          Deposit: body.deposit?.toFixed(2) || "",
          Balance_Due: body.balanceDue?.toFixed(2) || "",
          Charged_to_Client: body.chargedToClient?.toFixed(2) || "",
          Difference: body.difference.toFixed(2),
          Highest_Pricing_Group: body.highestPg,
          Commission_Rate: body.commRate != null ? `${(body.commRate * 100).toFixed(0)}%` : "",
          Base_Commission: body.baseCommission?.toFixed(2) || "",
          Over_Under_Commission: body.overUnderComm.toFixed(2),
          Total_Commission: body.totalCommission?.toFixed(2) || "",
          Num_Windows: body.lines.length,
          Contact_ID: results.contactId || "",
          Deal_ID: results.dealId || "",
        };

        await appendSheetRow(workbookId, worksheetName, rowData);
        results.sheetRowAdded = true;
      } else {
        results.errors.push("ZOHO_SHEET_WORKBOOK_ID not configured — skipping sheet row");
      }
    } catch (e) {
      results.errors.push(`Sheet append failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── Result ────────────────────────────────────────────────────────
    results.success = results.contactId != null || results.dealId != null;

    return NextResponse.json(results, { status: results.success ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildDealDescription(data: SubmitPricingRequest): string {
  const lines = data.lines.map((l) =>
    `  • ${l.desc} — ${l.dims} (qty ${l.qty}) | ${l.film} (${l.brand}) | Grp ${l.pg} | ${l.chargedSF.toFixed(1)} SF | ${fmt$(l.lineTotal)}`
  ).join("\n");

  return `Window Film Pricing — ${data.date}
User: ${data.userName} (${data.userLoc})
Job Type: ${data.jobType || "Residential"}
Customer: ${data.customer}${data.jobType === "Commercial" && data.companyName ? ` | Business: ${data.companyName}` : ""}${data.jobType === "Commercial" && data.contactPersonName ? ` | Contact: ${data.contactPersonName}` : ""}
Address: ${data.address}${data.cityStateZip ? `, ${data.cityStateZip}` : ""}
${data.phone ? `Phone: ${data.phone}\n` : ""}${data.email ? `Email: ${data.email}\n` : ""}
Line Items:
${lines}

Film Total: ${fmt$(data.total)}
Total Cost: ${fmt$(data.totalCost ?? data.total)}
${data.chargedToClient != null ? `Charged to Client: ${fmt$(data.chargedToClient)}` : ""}
${data.totalCommission != null ? `Commission: ${fmt$(data.totalCommission)}` : ""}`;
}

function buildNoteContent(data: SubmitPricingRequest): string {
  const lines = data.lines.map((l) =>
    `${l.desc}: ${l.dims} qty ${l.qty}
  Film: ${l.film} (${l.brand})
  Group ${l.pg} · ${l.psf != null ? "$" + l.psf.toFixed(2) + "/SF" : "—"}
  Roll: ${l.rollW}" | Actual: ${l.actualSF.toFixed(2)} SF | Charged: ${l.chargedSF.toFixed(2)} SF | Waste: ${l.wastageSF.toFixed(2)} SF
  Line Total: ${fmt$(l.lineTotal)}
`
  ).join("\n");

  return `PRICING DETAIL — ${data.date}

Customer: ${data.customer}
Address: ${data.address}${data.cityStateZip ? `, ${data.cityStateZip}` : ""}
${data.phone ? `Phone: ${data.phone}\n` : ""}${data.email ? `Email: ${data.email}\n` : ""}User: ${data.userName} (${data.userLoc})
Min dimension: ${data.minDim}"

LINE ITEMS:
${lines}

SUMMARY:
  Actual SF: ${data.totalActual.toFixed(2)}
  Charged SF: ${data.totalCharged.toFixed(2)}
  Subtotal: ${fmt$(data.subtotal)}
${data.minAdj > 0 ? `  Min adjustment: +${fmt$(data.minAdj)}\n` : ""}  Film Total: ${fmt$(data.total)}
${data.chargedToClient != null ? `  Charged to client: ${fmt$(data.chargedToClient)}\n  Difference: ${fmt$(data.difference)}` : ""}

ADJUSTMENTS:
${data.discount && data.discount > 0 ? `  Discount: −${fmt$(data.discount)}\n` : ""}${data.feeAmount != null ? `  Fee (${data.feePct ?? 4}%): +${fmt$(data.feeAmount)}\n` : ""}  Total Cost: ${fmt$(data.totalCost ?? data.total)}
${data.deposit && data.deposit > 0 ? `  Deposit: −${fmt$(data.deposit)}\n  Balance Due: ${fmt$(data.balanceDue ?? data.totalCost ?? data.total)}` : ""}

COMMISSION:
${data.baseCommission != null ? `  Base: ${data.commRate != null ? (data.commRate * 100).toFixed(0) : "—"}% of ${fmt$(data.total)} = ${fmt$(data.baseCommission)}` : "  N/A"}
${data.overUnderComm > 0 ? `  Over/under: 5% of ${fmt$(data.difference)} = ${fmt$(data.overUnderComm)}` : ""}
${data.totalCommission != null ? `  Total commission: ${fmt$(data.totalCommission)}` : ""}`;
}

function fmt$(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
