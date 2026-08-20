/**
 * POST /api/commission-sheet-pdf
 *
 * Renders the editable Commission Sheet (V-10.9 template) to a PDF and
 * returns it directly as a file download — no Zoho involvement, this is
 * purely a client-side-triggered "download this exact edited sheet" action.
 * Reuses the same htmlToPdf() pipeline as the Zoho estimate PDF generator.
 *
 * Returns: application/pdf binary
 */

import { NextRequest, NextResponse } from "next/server";
import { htmlToPdf } from "@/lib/pdf";
import { buildCommissionSheetHTML, type ProposalData, type CommissionSheetExtras } from "@/lib/proposal";

export async function POST(request: NextRequest) {
  try {
    const body: { proposalData: ProposalData; extras: CommissionSheetExtras } = await request.json();

    if (!body.proposalData || !body.extras) {
      return NextResponse.json(
        { error: "Missing proposalData or extras" },
        { status: 400 }
      );
    }

    const html = buildCommissionSheetHTML(body.proposalData, body.extras);
    const pdfBuffer = await htmlToPdf(html);
    const filename = `SWT-${(body.proposalData.customer || "commission-sheet").replace(/\s+/g, "-")}-commission-sheet.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
