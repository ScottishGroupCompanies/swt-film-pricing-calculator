/**
 * GET /api/zoho/health-check
 * 
 * Checks if Zoho credentials are configured and the API is reachable.
 * Used by the frontend to show integration status.
 */

import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/zoho";

export async function GET() {
  const status = await healthCheck();
  return NextResponse.json(status);
}
