/**
 * POST /api/zoho/email-rep
 * 
 * Sends an email to the sales rep after pricing data is submitted to Zoho.
 * The email says: "I added [Customer] into prospects — please check it out
 * and make sure everything is correct."
 * 
 * Once the rep confirms everything is good, they'll update the Google Sheet
 * (Phase 3), which triggers the invoice creation agent.
 * 
 * Required env vars:
 * - SMTP_HOST — e.g. smtp.gmail.com
 * - SMTP_PORT — e.g. 587
 * - SMTP_USER — email account
 * - SMTP_PASS — email password or app password
 * - REP_EMAIL_AMY — Amy's email
 * - REP_EMAIL_BLAKE — Blake's email
 */

import { NextRequest, NextResponse } from "next/server";
import { createTransport, type Transporter } from "nodemailer";

interface EmailRepRequest {
  userName: string;
  customer: string;
  dealId?: string | null;
  contactId?: string | null;
  total: number;
  sheetRowAdded: boolean;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP configuration. Need SMTP_HOST, SMTP_USER, and SMTP_PASS.");
  }

  transporter = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

function getRepEmail(userName: string): string | null {
  const name = userName.toLowerCase();
  if (name === "amy") return process.env.REP_EMAIL_AMY || null;
  if (name === "blake") return process.env.REP_EMAIL_BLAKE || null;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailRepRequest = await request.json();

    if (!body.userName || !body.customer) {
      return NextResponse.json(
        { success: false, error: "Missing userName and customer" },
        { status: 400 }
      );
    }

    const repEmail = getRepEmail(body.userName);
    if (!repEmail) {
      return NextResponse.json(
        { success: false, error: `No email configured for user: ${body.userName}` },
        { status: 400 }
      );
    }

    const transport = getTransporter();
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

    const subject = `New Prospect Added: ${body.customer} — Please Review`;
    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #515251; padding: 20px 24px; border-radius: 10px 10px 0 0; border-bottom: 3px solid #82b45a;">
          <h1 style="color: #fff; font-size: 20px; margin: 0; font-weight: 600;">
            Scottish Window Tinting
          </h1>
          <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 4px 0 0;">
            New Prospect Notification
          </p>
        </div>
        
        <div style="background: #f7f8f5; padding: 24px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 15px; color: #3a3b3a; line-height: 1.6;">
            Hi ${body.userName},
          </p>
          
          <p style="font-size: 15px; color: #3a3b3a; line-height: 1.6;">
            I've added <strong>${body.customer}</strong> into prospects in Zoho CRM. 
            Please check it out and make sure everything is correct.
          </p>

          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <div style="font-size: 11px; font-weight: 600; color: #6e9a47; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
              Job Summary
            </div>
            <table style="width: 100%; font-size: 14px; color: #3a3b3a;">
              <tr><td style="padding: 4px 0; color: #888;">Customer</td><td style="padding: 4px 0; font-weight: 500;">${body.customer}</td></tr>
              <tr><td style="padding: 4px 0; color: #888;">Total</td><td style="padding: 4px 0; font-weight: 500;">$${body.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
              ${body.dealId ? `<tr><td style="padding: 4px 0; color: #888;">Deal ID</td><td style="padding: 4px 0; font-family: monospace; font-size: 12px;">${body.dealId}</td></tr>` : ""}
              ${body.sheetRowAdded ? `<tr><td style="padding: 4px 0; color: #888;">Sheet</td><td style="padding: 4px 0;">✅ Pricing row added to Zoho Sheet</td></tr>` : ""}
            </table>
          </div>

          <p style="font-size: 15px; color: #3a3b3a; line-height: 1.6;">
            Once you've reviewed and confirmed everything looks good, please update the 
            pricing confirmation in the shared sheet. This will trigger invoice creation 
            automatically.
          </p>

          <p style="font-size: 13px; color: #888; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            This is an automated message from the SWT Pricing Calculator.
          </p>
        </div>
      </div>
    `;

    const text = `Hi ${body.userName},

I've added ${body.customer} into prospects in Zoho CRM. Please check it out and make sure everything is correct.

Job Summary:
  Customer: ${body.customer}
  Total: $${body.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  ${body.dealId ? `Deal ID: ${body.dealId}` : ""}
  ${body.sheetRowAdded ? "Pricing row added to Zoho Sheet ✅" : ""}

Once you've reviewed and confirmed everything looks good, please update the pricing confirmation in the shared sheet. This will trigger invoice creation automatically.

— SWT Pricing Calculator (automated)`;

    await transport.sendMail({
      from: `"SWT Pricing Calculator" <${fromEmail}>`,
      to: repEmail,
      subject,
      text,
      html,
    });

    return NextResponse.json({ success: true, sentTo: repEmail });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
