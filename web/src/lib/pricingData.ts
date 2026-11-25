// SWT Film Pricing Calculator — Data
// Prices, films, and bulk discounts: data/ScottishPricing-26_12-Accounts.xlsm
// (generated into ./pricing/catalog.ts). V-10.9 rates are not used.

export {
  FILMS,
  PRICING_GROUP_RATES as PRICING_GROUPS,
  WORKBOOK_MIN_DIMENSION_INCHES as MIN_DIM_DEFAULT,
  WORKBOOK_MIN_WINDOW_PRICE as MIN_PRICE,
} from "./pricing/catalog.ts";
import type { CatalogFilm as Film } from "./pricing/catalog.ts";
export type { Film };
import { chargedArea, ROLL_WIDTHS } from "./pricing/engine.ts";
export { ROLL_WIDTHS };

/**
 * Install-only labor rate. Multiplied by the window's exact measured
 * square feet (width × height × qty ÷ 144). Film waste, roll-width
 * rounding, and the 8" minimum dimension are not applied.
 */
export const INSTALL_ONLY_RATE_PER_SQ_FT = 10;

/** Exact measured area in square feet. Does not apply the film minimum dimension. */
export function exactWindowSqFt(widthInches: number, heightInches: number, qty: number): number {
  if (!(widthInches > 0) || !(heightInches > 0) || !(qty > 0)) return 0;
  return (widthInches * heightInches * qty) / 144;
}

export function installOnlyLaborTotal(exactSqFt: number): number {
  if (!(exactSqFt > 0)) return 0;
  return exactSqFt * INSTALL_ONLY_RATE_PER_SQ_FT;
}
export const DEFAULT_FEE_PCT = 4; // 4% fee (editable per job)

// Commission: base commission = user's flat rate x Subtotal (Film Total minus
// discount, before the fee). Over/Under adjustment: if the rep charged the
// client MORE than Total Cost, they earn their own rate on the overage; if
// they charged LESS (a loss), the loss is split 50/50 with the company —
// see getOverUnderComm() below. Matches the "Film Commission" sheet exactly.
//
// SECURITY: the actual roster + commission rates now live SERVER-SIDE ONLY
// in src/lib/auth.ts (never imported by client components). The logged-in
// user's own data is fetched at runtime from /api/auth/me — see
// PricingCalculator.tsx's useEffect. This file only keeps the shared
// `User` type so client code can still type the object it receives back.

export interface User {
  id: string;
  name: string;
  loc: string;
  glassRate: number | null;
  filmRate: number | null; // flat commission rate on film sale total
}


export const BRANDS = ["Vista", "3M", "Huper", "Llumar", "Other"];

export const BRAND_COLORS: Record<string, string> = {
  Vista: "#1e40af",
  "3M": "#dc2626",
  Huper: "#15803d",
  Llumar: "#7e22ce",
  LLumar: "#7e22ce",
  Other: "#515251",
};

// ─── HELPERS ──────────────────────────────────────────────────────────

export const fmt$ = (n: number | null | undefined): string =>
  n == null ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtSF = (n: number | null | undefined): string =>
  n == null ? "—" : n.toFixed(2) + " SF";

export function getRoll(w: number): number {
  for (const r of ROLL_WIDTHS) {
    if (w <= r) return r;
  }
  return ROLL_WIDTHS[ROLL_WIDTHS.length - 1];
}

// V-10.9: Commission is a flat rate per user, not tiered by pricing group.
export function getCommRate(user: User | null): number | null {
  if (!user) return null;
  return user.filmRate;
}

// Over/Under adjustment on the base commission, matching the "Film Commission"
// sheet exactly: overcharge the client -> the rep earns their own rate on the
// overage; undercharge (a loss) -> the loss is split 50/50 with the company.
export function getOverUnderComm(difference: number, commRate: number | null): number {
  if (commRate == null) return 0;
  return difference > 0 ? difference * commRate : difference * 0.5;
}

export interface RowData {
  id: number;
  desc: string;
  w: string;
  h: string;
  qty: string;
  film: Film | null;
  pgOverride: number | null;
  lineTotalOverride: string; // manual override for the auto-calculated line total (empty = use calculated value)
}

export interface RowCalc {
  w: number;
  h: number;
  qty: number;
  rollW: number;
  actualSF: number;
  chargedSF: number;
  wastageSF: number;
  pg: number | null;
  psf: number | null;
  lineTotal: number | null;
  calculatedLineTotal: number | null; // the auto-calculated value, kept even when overridden (for reference/reset)
  isOverridden: boolean;
}

/**
 * Charged area for one window. `minD` is kept so saved drafts still type-check.
 * Preferences lists an 8" minimum dimension, and the Film Pricing formulas
 * do not use it, so the measurement is priced as entered.
 */
export function calcRowGeometry(row: RowData, _minD: number): Omit<RowCalc, "pg" | "psf" | "lineTotal" | "calculatedLineTotal" | "isOverridden"> | null {
  if (!row.w || !row.h || !row.qty) return null;
  const w = parseFloat(row.w);
  const h = parseFloat(row.h);
  const qty = parseInt(row.qty, 10) || 1;
  const area = chargedArea(w, h, qty);
  if (!area) return null;
  const actualSF = (w * h * qty) / 144;
  return {
    w,
    h,
    qty,
    rollW: area.rollWidth,
    actualSF,
    chargedSF: area.chargedSqFt,
    wastageSF: area.chargedSqFt - actualSF,
  };
}

let _rid = 0;
export const newRow = (): RowData => ({ id: ++_rid, desc: "", w: "", h: "", qty: "1", film: null, pgOverride: null, lineTotalOverride: "" });

export const initials = (n: string): string =>
  n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);
