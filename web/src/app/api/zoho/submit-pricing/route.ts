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
  parseCityStateZip, getRecord, updateRecord, findCrmUserIdByEmail,
  type ZohoCRMRecord,
} from "@/lib/zoho";
import { getSessionUserId } from "@/lib/sessionCookies";
import { findUserById } from "@/lib/auth";
import { additionalChargeHeading } from "@/lib/additionalCharges";
import { INSTALL_ONLY_RATE_PER_SQ_FT } from "@/lib/pricingData";
import { zohoSubmitResult } from "@/lib/zohoSubmitResult";
import { resolveDealOwner } from "@/lib/zohoOwners";
import { resolveOpportunityStage } from "@/lib/opportunityStage";
import { runQuoteZohoRoute } from "@/lib/quoteZohoRoute";
import { quoteFailureText } from "@/lib/zohoOAuth";

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
  opportunityStage?: string;
  installOnly?: boolean;
  bulkDiscount?: number;
  bulkDiscountLabel?: string;
  additionalCharges?: { name: string; description: string; amount: number }[];
}

// Address parsing lives in @/lib/zoho now (parseCityStateZip) — shared with
// create-estimate-record/route.ts so both use the same tolerant parser.

export async function POST(request: NextRequest) {
  return runQuoteZohoRoute(() => submitPricing(request));
}

async function submitPricing(request: NextRequest) {
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

    // Owner is the logged-in rep. Resolve it before any CRM create so a
    // failed opportunity does not leave an Account and Contact owned by
    // the API user (Jenny).
    let ownerId: string;
    try {
      const sessionUserId = await getSessionUserId();
      const sessionUser = sessionUserId ? findUserById(sessionUserId) : null;
      if (!sessionUser) {
        return NextResponse.json(
          { success: false, errors: ["Deal creation failed: no logged-in rep, so Zoho records were not created."] },
          { status: 401 },
        );
      }
      ownerId = (await resolveDealOwner(sessionUser, findCrmUserIdByEmail)).id;
    } catch (e) {
      return NextResponse.json(
        { success: false, errors: [`Deal creation failed: ${quoteFailureText(e)}`] },
        { status: 500 },
      );
    }

    let createdNewContact = false;

    // ── 1. Resolve Contact in CRM (reuse existing, or find/create) ─────
    // Runs BEFORE Account resolution: for Residential jobs, the Account we
    // link is whatever Zoho already auto-created/linked for this exact
    // Contact — not a fresh Account searched/created by the customer's
    // typed name (which would create a DUPLICATE, since Zoho's own
    // auto-generated Account name for a Contact often doesn't match the
    // person's name at all — confirmed on real data).
    try {
      if (body.existingContactId) {
        // Rep selected an existing contact via the search picker — reuse it,
        // and fetch its own auto-linked Account (needed below).
        results.contactId = body.existingContactId;
        const existingContact = await getRecord("Contacts", body.existingContactId);
        const existingAccountLookup = existingContact?.Account_Name as { id?: string; name?: string } | null | undefined;
        if (existingAccountLookup?.id) {
          results.accountId = existingAccountLookup.id;
        }
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

          const newContactId = await createContact({
            firstName,
            lastName,
            email: isCommercial ? body.contactPersonEmail || body.email : body.email,
            phone: isCommercial ? body.contactPersonPhone || body.phone : body.phone,
            mailingStreet: billingSource.street,
            mailingCity,
            mailingState,
            mailingZip,
            ownerZohoUserId: ownerId,
          });
          createdNewContact = true;
          // Re-fetch so we can read back the Account_Name Zoho auto-linked
          // on creation (needed below for Residential Account resolution).
          contact = (await getRecord("Contacts", newContactId)) || { id: newContactId };
        }

        results.contactId = contact ? (contact.id as string) : null;
        // Stash the Contact's own auto-linked Account for step 2 below.
        const contactAccountLookup = contact?.Account_Name as { id?: string; name?: string } | null | undefined;
        if (contactAccountLookup?.id) {
          results.accountId = contactAccountLookup.id;
        }
      }
    } catch (e) {
      results.errors.push(`Contact creation failed: ${quoteFailureText(e)}`);
    }

    // Zoho auto-creates a personal account for a new contact, owned by the
    // API user. Move that account to the rep before anything else uses it.
    if (createdNewContact && results.accountId) {
      try {
        await updateRecord("Accounts", results.accountId, { Owner: { id: ownerId } });
      } catch (e) {
        results.errors.push(`Could not assign the account to the rep: ${quoteFailureText(e)}`);
      }
    }

    // ── 2. Resolve Account — REQUIRED for every job, not just Commercial.
    //       This Zoho org has "Accounts & its contacts sync" enabled in
    //       Books, which means every CRM Deal must have a real Account
    //       linked before a Books transaction (Estimate) can be created
    //       against it — omitting this for Residential jobs caused
    //       "Account is mandatory for this Potential to create a
    //       transaction" / Permission Denied when filling out the
    //       estimate.
    //   Commercial: search/create a real business Account by company name.
    //   Residential: reuse the Account already auto-linked to the Contact
    //     above (results.accountId, if set) — only search/create a
    //     fallback by the customer's own name if the Contact had none.
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
            ownerZohoUserId: ownerId,
          });
        }
      } catch (e) {
        results.errors.push(`Account creation failed: ${quoteFailureText(e)}`);
      }
    } else if (!results.accountId && body.customer?.trim()) {
      // Fallback: the Contact somehow has no Account linked (shouldn't
      // normally happen — Zoho auto-creates one per Contact) — create one
      // under the customer's own name so the Deal always has something to
      // link.
      try {
        const accountName = body.customer.trim();
        const existingAccount = await searchAccount(accountName);
        if (existingAccount?.id) {
          results.accountId = existingAccount.id as string;
        } else {
          const { city, state, zip } = parseCityStateZip(body.cityStateZip);
          results.accountId = await createAccount({
            accountName,
            phone: body.phone,
            email: body.email,
            billingStreet: body.address,
            billingCity: city,
            billingState: state,
            billingZip: zip,
            ownerZohoUserId: ownerId,
          });
        }
      } catch (e) {
        results.errors.push(`Account creation failed: ${quoteFailureText(e)}`);
      }
    }

    // Books imports the CRM *account*. A commercial contact created above
    // is still pointing at Zoho's auto personal account, so the import
    // would bring the company over with no contact person. Point the
    // contact at the business account first.
    if (isCommercial && results.contactId && results.accountId) {
      try {
        await updateRecord("Contacts", results.contactId, {
          Account_Name: { id: results.accountId },
        });
      } catch (e) {
        results.errors.push(`Could not link the contact to the business account: ${quoteFailureText(e)}`);
      }
    }

    // Residential deals reuse the account Zoho auto-created for the
    // contact. That account often has a city and nothing else, which
    // Books then renders as "Centennial null null". Write the parsed
    // billing address onto it before the estimate imports the account.
    if (!isCommercial && results.accountId) {
      try {
        const { city, state, zip } = parseCityStateZip(body.cityStateZip);
        const fields: ZohoCRMRecord = {};
        if (body.address?.trim()) fields.Billing_Street = body.address.trim();
        if (city) fields.Billing_City = city;
        if (state) fields.Billing_State1 = state;
        if (zip) fields.Billing_Code = zip;
        if (body.phone?.trim()) fields.Phone = body.phone.trim();
        if (body.email?.trim()) fields.Email = body.email.trim();
        if (Object.keys(fields).length) {
          await updateRecord("Accounts", results.accountId, fields);
        }
      } catch (e) {
        results.errors.push(`Could not save the account billing address: ${quoteFailureText(e)}`);
      }
    }

    // ── 3. Create Deal (Opportunity) in CRM ───────────────────────────
    try {
      let dealName = body.opportunityName?.trim() || `${body.customer} — Window Film ${body.date}`;
      if (body.installOnly && !/install only/i.test(dealName)) {
        dealName = `${dealName} — Install only`;
      }
      const stage = resolveOpportunityStage(body.opportunityStage);
      const dealDescription = buildDealDescription({ ...body, opportunityStage: stage });
      const { city: installCity, state: installState, zip: installZip } = parseCityStateZip(body.cityStateZip);

      const dealResult = await createDeal({
        dealName,
        contactId: results.contactId || undefined,
        accountId: results.accountId || undefined,
        amount: body.chargedToClient || body.totalCost || body.total,
        stage,
        description: dealDescription,
        userName: body.userName,
        ownerZohoUserId: ownerId,
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
        results.errors.push(`Note creation failed: ${quoteFailureText(e)}`);
      }
    } catch (e) {
      results.errors.push(`Deal creation failed: ${quoteFailureText(e)}`);
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
      results.errors.push(`Sheet append failed: ${quoteFailureText(e)}`);
    }

    // ── Result ────────────────────────────────────────────────────────
    // A contact without an opportunity is a failed send. The UI must show
    // the deal error instead of a green success.
    const outcome = zohoSubmitResult({
      dealId: results.dealId,
      errors: results.errors,
    });
    results.success = outcome.success;
    results.errors = outcome.errors;

    return NextResponse.json(results, { status: outcome.status });
  } catch (e) {
    if (e instanceof Error && e.name === "ZohoReconnectError") throw e;
    return NextResponse.json(
      { success: false, error: quoteFailureText(e) },
      { status: 500 }
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildDealDescription(data: SubmitPricingRequest): string {
  const lines = data.lines.map((l) =>
    `  • ${l.desc} — ${l.dims} (qty ${l.qty}) | ${l.film} (${l.brand}) | Grp ${l.pg} | ${l.chargedSF.toFixed(1)} SF | ${fmt$(l.lineTotal)}`
  ).join("\n");

  const chargeLines = (data.additionalCharges || [])
    .filter((charge) => charge.amount !== 0)
    .map((charge) => `  • ${additionalChargeHeading(charge)} — ${fmt$(charge.amount)}`)
    .join("\n");

  return `${data.installOnly ? `INSTALL ONLY — customer supplies the film. Installation labor is $${INSTALL_ONLY_RATE_PER_SQ_FT.toFixed(2)} per exact square foot. No film material charge.\n` : ""}Window Film Pricing — ${data.date}
User: ${data.userName} (${data.userLoc})
Job Type: ${data.jobType || "Residential"}${data.installOnly ? " | Install only" : ""}
Stage: ${resolveOpportunityStage(data.opportunityStage)}
Customer: ${data.customer}${data.jobType === "Commercial" && data.companyName ? ` | Business: ${data.companyName}` : ""}${data.jobType === "Commercial" && data.contactPersonName ? ` | Contact: ${data.contactPersonName}` : ""}
Address: ${data.address}${data.cityStateZip ? `, ${data.cityStateZip}` : ""}
${data.phone ? `Phone: ${data.phone}\n` : ""}${data.email ? `Email: ${data.email}\n` : ""}
Line Items:
${lines}
${chargeLines ? `\nAdditional charges:\n${chargeLines}\n` : ""}
${data.installOnly ? "Film material: $0.00\n" : ""}Film Total: ${fmt$(data.total)}
${data.bulkDiscount && data.bulkDiscount > 0 ? `${data.bulkDiscountLabel || "Bulk film discount"}: −${fmt$(data.bulkDiscount)}\n` : ""}Total Cost: ${fmt$(data.totalCost ?? data.total)}
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

  const chargeLines = (data.additionalCharges || [])
    .filter((charge) => charge.amount !== 0)
    .map((charge) => `  ${additionalChargeHeading(charge)} — ${fmt$(charge.amount)}`)
    .join("\n");

  return `PRICING DETAIL — ${data.date}
${data.installOnly ? `INSTALL ONLY — customer supplies the film. Installation labor is $${INSTALL_ONLY_RATE_PER_SQ_FT.toFixed(2)} per exact square foot. No film material charge.\n` : ""}
Customer: ${data.customer}
Address: ${data.address}${data.cityStateZip ? `, ${data.cityStateZip}` : ""}
${data.phone ? `Phone: ${data.phone}\n` : ""}${data.email ? `Email: ${data.email}\n` : ""}User: ${data.userName} (${data.userLoc})

LINE ITEMS:
${lines}

SUMMARY:
  Actual SF: ${data.totalActual.toFixed(2)}
  Charged SF: ${data.totalCharged.toFixed(2)}
  Subtotal: ${fmt$(data.subtotal)}
${data.minAdj > 0 ? `  Min adjustment: +${fmt$(data.minAdj)}\n` : ""}  Film Total: ${fmt$(data.total)}
${data.chargedToClient != null ? `  Charged to client: ${fmt$(data.chargedToClient)}\n  Difference: ${fmt$(data.difference)}` : ""}

ADJUSTMENTS:
${data.installOnly ? "  Film material: $0.00\n" : ""}${data.bulkDiscount && data.bulkDiscount > 0 ? `  ${data.bulkDiscountLabel || "Bulk film discount"}: −${fmt$(data.bulkDiscount)}\n` : ""}${data.discount && data.discount > 0 ? `  Discount: −${fmt$(data.discount)}\n` : ""}${chargeLines ? `${chargeLines}\n` : ""}${data.feeAmount != null ? `  Fee (${data.feePct ?? 4}%): +${fmt$(data.feeAmount)}\n` : ""}  Total Cost: ${fmt$(data.totalCost ?? data.total)}
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
