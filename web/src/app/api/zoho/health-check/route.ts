/**
 * GET /api/zoho/health-check
 * 
 * Checks if Zoho credentials are configured and the API is reachable.
 * Used by the frontend to show integration status.
 */

import { NextResponse } from "next/server";

/**
 * Tells the calculator whether Zoho env vars are present. It does not call
 * Zoho. The old check refreshed a token and listed a deal on every page
 * load, which burned the rate limit and made the first paint wait on Zoho.
 */
export async function GET() {
  const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"];
  const configured = required.every((name) => Boolean(process.env[name]));
  return NextResponse.json({
    configured,
    missingVars: [] as string[],
    crmReachable: null,
    sheetReachable: null,
    tokenValid: null,
  });
}
