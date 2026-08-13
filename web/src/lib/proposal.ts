// Client-side proposal/summary generation — no AI API needed
import { fmt$, MIN_PRICE } from "./pricingData";

export interface ProposalLine {
  desc: string;
  dims: string;
  qty: number;
  lineTotal: number;
  film?: string;
  brand?: string;
  pg?: number | null;
  psf?: number | null;
  rollW?: number;
  actualSF?: number;
  chargedSF?: number;
  wastageSF?: number;
}

export interface ProposalData {
  customer: string;
  address: string;
  cityStateZip?: string;
  phone?: string;
  email?: string;
  designerName: string;
  designerLoc: string;
  date: string;
  lines: ProposalLine[];
  totalActual: number;
  totalCharged: number;
  subtotal: number;
  minAdj: number;
  total: number;
  highestPg: number;
  commission: number | null;
  commRate: number | null;
  chargedToClient: number | null;
  difference: number;
  overUnderComm: number;
  baseCommission: number | null;
  minDim: number;
  // Editable post-calculation summary
  discount?: number;
  subtotalAfterDiscount?: number;
  feePct?: number;
  feeAmount?: number;
  totalCost?: number;
  deposit?: number;
  balanceDue?: number;
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

const BRAND = {
  green: "#82b45a",
  greenDark: "#6e9a47",
  darkGray: "#515251",
  lightGray: "#f7f8f5",
  border: "#e5e7eb",
};

const TERMS_AND_CONDITIONS_HTML = `
  <p><strong>Terms and Conditions for Scottish Window Tinting LLC</strong></p>
  <p><strong>1. Introduction</strong><br>
  Scottish Window Tinting ("we," "us," "our") provides professional window film installation services for residential, commercial, and public spaces. By using our services, you agree to the terms outlined below.</p>
  <p><strong>2. Services Provided</strong><br>
  Residential Window Tinting: Installation of window films designed to enhance privacy, reduce glare, protect against UV rays, and improve energy efficiency in homes.<br>
  Commercial Window Tinting: Installation services for office buildings, storefronts, and commercial properties, with options for privacy, branding, UV protection, and energy savings.<br>
  Public Spaces: Customized window film solutions for schools, government buildings, and other public spaces, focused on safety, security, and UV reduction.</p>
  <p><strong>3. Pricing and Payment Terms</strong><br>
  Pricing is based on factors such as window dimensions, film type, and installation complexity.<br>
  Payment is due according to the agreed-upon schedule in the project contract.<br>
  Accepted payment methods include credit card, check, and ACH transfers.</p>
  <p><strong>4. Project Scheduling and Completion</strong><br>
  Upon contract approval, a project schedule will be established. While we strive to adhere to projected timelines, installation dates are subject to change due to factors like weather, site access, or availability of materials.<br>
  Any adjustments to the schedule will be communicated promptly.</p>
  <p><strong>5. Variations in Window Film Appearance</strong><br>
  Due to variations in lighting, window placement, and the film's specific properties, final appearances may differ slightly from initial samples or displays. Please note that certain films may require time to cure and achieve their final clarity.</p>
  <p><strong>6. Warranty and Maintenance</strong><br>
  We provide warranties on materials and workmanship, subject to the terms specified by the film manufacturer and any additional guarantees included in your contract.<br>
  Care instructions will be provided upon installation to ensure longevity and performance. Damages resulting from improper cleaning or maintenance are not covered under warranty.</p>
  <p><strong>7. Client Satisfaction and Issue Resolution</strong><br>
  We are committed to client satisfaction. Should there be any concerns with the installation or the product, please contact us promptly, and we will address the issue on a case-by-case basis.</p>
  <p><strong>8. Limitations of Liability</strong><br>
  We are not liable for any damages arising from external factors, such as natural disasters, or issues resulting from improper care post-installation.<br>
  Our liability is limited to the scope of our services and does not extend to indirect or consequential damages.</p>
  <p><strong>9. Modifications to Terms</strong><br>
  We reserve the right to modify these terms at any time. Updated terms will be available on our website, and continued use of our services indicates acceptance of any modifications.</p>
`;

/**
 * Branded proposal/estimate HTML — matches the standard SWT proposal layout
 * (green diagonal "Accepted" ribbon, logo, Bill To / Installation Address /
 * Quote Date / Salesperson / Payment Terms, itemized table, Sub Total /
 * Total, Notes, Terms & Conditions). Shared by the in-app "Generate
 * Proposal" print/download flow AND the Zoho estimate PDF generator, so
 * both outputs always match exactly.
 */
export function buildPrintableHTML(d: ProposalData, quoteNumber?: string): string {
  const rows = d.lines.map((l) => {
    const filmLabel = l.film && l.film !== "—" ? l.film : "film";
    const desc = `Supply and install ${filmLabel} on ${l.qty} window${l.qty > 1 ? "s" : ""}`;
    return `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};vertical-align:top;">
        <div style="font-weight:600;color:${BRAND.darkGray};">${l.desc || "Window Film"}</div>
        <div style="font-size:12px;color:#888;margin-top:3px;">${desc}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:right;vertical-align:top;font-weight:500;">
        ${l.lineTotal.toFixed(2)}
      </td>
    </tr>`;
  }).join("");

  const feeRow = d.feeAmount != null && d.feeAmount > 0 ? `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};vertical-align:top;">
        <div style="font-weight:600;color:${BRAND.darkGray};">Fee (No Tax)</div>
        <div style="font-size:12px;color:#888;margin-top:3px;">${d.feePct ?? 4}% fee includes shipping, handling, delivery, and energy surcharge.</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:right;vertical-align:top;font-weight:500;">
        ${d.feeAmount.toFixed(2)}
      </td>
    </tr>` : "";

  const subTotal = d.total + (d.feeAmount || 0);
  const grandTotal = d.totalCost ?? d.total;
  const qNum = quoteNumber || `WT-${d.date.replace(/\D/g, "").slice(-6) || Date.now().toString().slice(-6)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SWT Proposal — ${d.customer || "Customer"}</title>
<style>
  @page { margin: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 48px 56px; position: relative; max-width: 800px; margin-left: auto; margin-right: auto; }
  .ribbon {
    position: absolute; top: 0; left: 0; width: 90px; height: 90px; overflow: hidden;
  }
  .ribbon span {
    position: absolute; display: block; width: 160px; padding: 6px 0; background: ${BRAND.green};
    box-shadow: 0 2px 6px rgba(0,0,0,.15); color: #fff; text-align: center; font-size: 12px; font-weight: 700;
    letter-spacing: 0.05em; left: -38px; top: 24px; transform: rotate(-45deg);
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; margin-top: 20px; }
  .logo-block { display: flex; align-items: center; gap: 8px; }
  .logo-text { font-size: 22px; font-weight: 800; color: ${BRAND.darkGray}; letter-spacing: 0.02em; }
  .logo-text .accent { color: ${BRAND.green}; }
  .company-info { font-size: 12px; color: #555; margin-top: 10px; line-height: 1.6; }
  .company-info strong { color: ${BRAND.darkGray}; }
  .proposal-title { text-align: right; }
  .proposal-title h1 { font-size: 34px; font-weight: 400; color: #333; margin: 0; }
  .proposal-title .quote-num { font-size: 13px; color: #666; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; margin-top: 28px; }
  .bill-to { font-size: 13px; color: #333; line-height: 1.6; }
  .bill-to .label { font-weight: 700; margin-bottom: 6px; }
  .bill-to .company { font-weight: 700; }
  .meta-table { font-size: 13px; color: #333; }
  .meta-table div { display: flex; justify-content: space-between; gap: 24px; padding: 3px 0; }
  .meta-table span:first-child { color: #666; }
  .meta-table span:last-child { font-weight: 600; text-align: right; }
  .install-addr { font-size: 13px; color: #333; margin-top: 18px; line-height: 1.6; }
  .install-addr .label { font-weight: 700; margin-bottom: 4px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 36px; }
  table.items thead th { text-align: left; padding: 10px; background: ${BRAND.darkGray}; color: #fff; font-size: 12px; font-weight: 600; }
  table.items thead th:last-child { text-align: right; }
  .totals { margin-top: 4px; width: 260px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 8px 10px; font-size: 13px; }
  .totals .subtotal { color: #555; }
  .totals .grand { background: ${BRAND.lightGray}; font-weight: 700; font-size: 15px; color: ${BRAND.darkGray}; border-top: 2px solid ${BRAND.green}; }
  .notes-section { margin-top: 40px; font-size: 13px; }
  .notes-section h3 { font-size: 14px; color: ${BRAND.darkGray}; margin-bottom: 6px; }
  .terms-section { margin-top: 24px; font-size: 11px; color: #555; line-height: 1.5; }
  .terms-section h3 { font-size: 14px; color: ${BRAND.darkGray}; margin-bottom: 8px; }
  .terms-section p { margin: 0 0 10px; }
  .signature { margin-top: 40px; font-size: 13px; }
  .signature .line { display: inline-block; width: 260px; border-bottom: 1px solid #333; margin-left: 12px; }
  @media print { body { padding: 40px 48px; } }
</style>
</head>
<body>
  <div class="ribbon"><span>Accepted</span></div>

  <div class="header">
    <div>
      <div class="logo-block">
        <span class="logo-text">SCOTTISH <span class="accent">WINDOW TINTING</span></span>
      </div>
      <div class="company-info">
        <strong>Scottish Window Tinting LLC</strong><br>
        7075 S Alton Way<br>
        Centennial Colorado 80112<br>
        U.S.A<br>
        (303) 662-8214<br>
        swt.admin@scottishwindowtinting.com<br>
        https://www.scottishwindowtinting.com/
      </div>
    </div>
    <div class="proposal-title">
      <h1>Proposal</h1>
      <div class="quote-num"># ${qNum}</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="bill-to">
      <div class="label">Bill To</div>
      <div class="company">${d.customer || "—"}</div>
      <div>${d.address || "—"}</div>
      <div>${d.cityStateZip || ""}</div>
      ${d.phone ? `<div>${d.phone}</div>` : ""}
      ${d.email ? `<div>${d.email}</div>` : ""}
    </div>
    <div class="meta-table">
      <div><span>Quote Date :</span><span>${d.date}</span></div>
      <div><span>Sales person :</span><span>${d.designerName || "—"}</span></div>
      <div><span>Payment Terms :</span><span>Upon completion</span></div>
    </div>
  </div>

  <div class="install-addr">
    <div class="label">Installation Address:</div>
    <div>${d.address || "—"}</div>
    <div>${d.cityStateZip || ""}</div>
    <div>U.S.A</div>
  </div>

  <table class="items">
    <thead>
      <tr><th>Item &amp; Description</th><th>Amount</th></tr>
    </thead>
    <tbody>
      ${rows}${feeRow}
    </tbody>
  </table>

  <div class="totals">
    <div class="subtotal"><span>Sub Total</span><span>${subTotal.toFixed(2)}</span></div>
    <div class="grand"><span>Total</span><span>$${grandTotal.toFixed(2)}</span></div>
  </div>

  <div class="notes-section">
    <h3>Notes</h3>
    <p>We Appreciate your business!</p>
  </div>

  <div class="terms-section">
    <h3>Terms &amp; Conditions</h3>
    ${TERMS_AND_CONDITIONS_HTML}
  </div>

  <div class="signature">
    Authorized Signature <span class="line"></span>
  </div>
</body>
</html>`;
}

export function buildCustomerProposal(d: ProposalData): string {
  const lines = d.lines.map((l, i) =>
    `  ${i + 1}. ${l.desc} (qty ${l.qty})${l.film && l.film !== "—" ? ` · ${l.film}` : ""} — ${fmt$(l.lineTotal)}`
  ).join("\n");

  const minNote = d.minAdj > 0
    ? `\n  Subtotal: ${fmt$(d.subtotal)}\n  Minimum job adjustment: +${fmt$(d.minAdj)}`
    : "";

  const hasAdjustments = (d.discount && d.discount > 0) || (d.feeAmount != null) || (d.deposit && d.deposit > 0);
  const adjustmentLines = hasAdjustments
    ? `\n  Film Total: ${fmt$(d.total)}` +
      (d.discount && d.discount > 0 ? `\n  Discount: −${fmt$(d.discount)}` : "") +
      (d.feeAmount != null ? `\n  Fee (${d.feePct ?? 4}%): +${fmt$(d.feeAmount)}` : "") +
      `\n  Total Cost: ${fmt$(d.totalCost ?? d.total)}` +
      (d.deposit && d.deposit > 0 ? `\n  Deposit: −${fmt$(d.deposit)}\n  Balance Due: ${fmt$(d.balanceDue ?? d.totalCost ?? d.total)}` : "")
    : "";

  const contactLines = [
    d.cityStateZip ? `${d.cityStateZip}` : null,
    d.phone ? `Phone: ${d.phone}` : null,
    d.email ? `Email: ${d.email}` : null,
  ].filter(Boolean).join("\n");

  return `Scottish Window Tinting
7075 S. Alton Way, Centennial, CO 80112
scottishwindowtinting.com

PROPOSAL — ${d.date}

Customer: ${d.customer || "—"}
Job Address: ${d.address || "—"}${contactLines ? `\n${contactLines}` : ""}
Designer: ${d.designerName || "—"} (${d.designerLoc || "—"})

LINE ITEMS:
${lines}
${minNote}
────────────────────────────────${adjustmentLines || `\n  TOTAL: ${fmt$(d.total)}`}

This proposal is valid for 30 days from the date above.
Pricing includes professional installation of premium window film.
Contact your designer to proceed or request modifications.`;
}

export function buildInternalRecord(d: ProposalData): string {
  const lines = d.lines.map((l, i) =>
    `  ${i + 1}. ${l.desc} — ${l.dims} (qty ${l.qty})` +
    ` | Film: ${l.film || "—"} (${l.brand || "—"})` +
    ` | Grp ${l.pg} · ${l.psf != null ? "$" + l.psf.toFixed(2) + "/SF" : "—"}` +
    ` | ${l.rollW}" roll` +
    ` | ${l.chargedSF?.toFixed(2)} charged SF (${l.actualSF?.toFixed(2)} actual, ${l.wastageSF?.toFixed(2)} wastage)` +
    ` | Line: ${fmt$(l.lineTotal)}`
  ).join("\n");

  const commBreakdown = d.baseCommission != null
    ? `  Base commission: ${d.commRate != null ? (d.commRate * 100).toFixed(0) : "—"}% of ${fmt$(d.total)} = ${fmt$(d.baseCommission)}\n` +
      (d.overUnderComm > 0
        ? `  Over/under: 5% of ${fmt$(d.difference)} overage = ${fmt$(d.overUnderComm)}\n`
        : "") +
      `  Total commission: ${d.commission != null ? fmt$(d.commission) : "—"}`
    : `  Commission: N/A (no designer selected)`;

  const contactLines = [
    d.cityStateZip ? `City/State/Zip: ${d.cityStateZip}` : null,
    d.phone ? `Phone: ${d.phone}` : null,
    d.email ? `Email: ${d.email}` : null,
  ].filter(Boolean).join("\n");

  const adjustmentBreakdown =
    `  Film Total: ${fmt$(d.total)}\n` +
    (d.discount && d.discount > 0 ? `  Discount: −${fmt$(d.discount)}\n` : "") +
    (d.feeAmount != null ? `  Fee (${d.feePct ?? 4}%): +${fmt$(d.feeAmount)}\n` : "") +
    `  Total Cost: ${fmt$(d.totalCost ?? d.total)}\n` +
    (d.deposit && d.deposit > 0 ? `  Deposit: −${fmt$(d.deposit)}\n  Balance Due: ${fmt$(d.balanceDue ?? d.totalCost ?? d.total)}` : "");

  return `INTERNAL RECORD — ${d.date}

Customer: ${d.customer || "—"}
Address: ${d.address || "—"}
${contactLines ? contactLines + "\n" : ""}Designer: ${d.designerName || "—"} (${d.designerLoc || "—"})
Min dimension: ${d.minDim}" | Min job price: $${MIN_PRICE}

LINE ITEMS:
${lines}

TOTALS:
  Actual SF: ${d.totalActual.toFixed(2)}
  Charged SF: ${d.totalCharged.toFixed(2)}
  Subtotal: ${fmt$(d.subtotal)}${d.minAdj > 0 ? ` → adjusted to ${fmt$(d.total)} (minimum)` : ` = ${fmt$(d.total)}`}
${d.chargedToClient != null ? `  Charged to client: ${fmt$(d.chargedToClient)}\n  Difference: ${fmt$(d.difference)}` : ""}

ADJUSTMENTS:
${adjustmentBreakdown}

COMMISSION:
${commBreakdown}`;
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printHTML(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 500);
}
