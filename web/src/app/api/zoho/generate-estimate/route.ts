/**
 * POST /api/zoho/generate-estimate
 *
 * Generates a branded PDF estimate (same layout as the in-app "Generate
 * Proposal" print/download — see src/lib/proposal.ts buildPrintableHTML)
 * and uploads it to Vercel Blob storage, then links it from a note on the
 * Deal (Opportunity) in Zoho CRM. Avoids Zoho's per-org file storage quota
 * entirely.
 *
 * Returns: { success, attachedTo, pdfUrl, errors[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { addNote } from "@/lib/zoho";
import { htmlToPdf } from "@/lib/pdf";
import { put } from "@vercel/blob";
import { buildPrintableHTML, type ProposalData } from "@/lib/proposal";

export async function POST(request: NextRequest) {
  try {
    const body: ProposalData = await request.json();

    if (!body.customer || !body.lines?.length || !body.total) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: customer, lines, and total are required." },
        { status: 400 }
      );
    }

    const dealId = (body as ProposalData & { dealId?: string }).dealId;
    const contactId = (body as ProposalData & { contactId?: string }).contactId;

    if (!dealId && !contactId) {
      return NextResponse.json(
        { success: false, error: "No Deal or Contact ID provided — send to Zoho Opportunities first, then generate the estimate." },
        { status: 400 }
      );
    }

    const results = {
      success: false,
      attachedTo: null as string | null,
      pdfUrl: null as string | null,
      errors: [] as string[],
    };

    const quoteNumber = `WT-${Date.now().toString().slice(-6)}`;
    const html = buildPrintableHTML(body, quoteNumber);

    try {
      const pdfBuffer = await htmlToPdf(html);
      const fileName = `estimates/${body.customer.replace(/\s+/g, "-")}-${quoteNumber}.pdf`;

      // Upload the PDF to Vercel Blob storage (public URL) — avoids Zoho's
      // per-org file storage quota entirely. We then link to it from a note
      // on the Deal/Contact so it's easy to find right on the Opportunity.
      const blob = await put(fileName, pdfBuffer, {
        access: "public",
        contentType: "application/pdf",
      });
      results.pdfUrl = blob.url;

      const noteTitle = `Estimate — ${body.customer} — ${body.date}`;
      const noteContent = `Estimate PDF generated for ${body.customer} (${quoteNumber}).\n\nView / download: ${blob.url}\n\nTotal: $${(body.totalCost ?? body.total).toFixed(2)}`;

      if (dealId) {
        await addNote(dealId, "Deals", noteTitle, noteContent);
        results.attachedTo = `Deal ${dealId}`;
      } else if (contactId) {
        await addNote(contactId, "Contacts", noteTitle, noteContent);
        results.attachedTo = `Contact ${contactId}`;
      }
      results.success = true;
    } catch (e) {
      results.errors.push(`Estimate PDF generation/upload failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    return NextResponse.json(results, { status: results.success ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}

