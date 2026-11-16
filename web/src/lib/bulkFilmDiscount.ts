/**
 * Bulk film discount from the pricing workbook.
 *
 * Jenny's V-10.9 workbook (2026-07-31) stores this table at
 * Preferences D46:R56. Film Pricing K47 looks it up with:
 *   IF(K45>0, IF(I47="✓", HLOOKUP(K45, Preferences!F46:R56, M46+1, TRUE) * K45 * -1, 0), 0)
 * K45 is the film total in dollars, M46 is the highest pricing group,
 * and I47 is the checkbox (default checked). The sheet labels that row "Other".
 *
 * The copy in this repo, data/ScottishPricing-26_12-Accounts.xlsm, has the
 * same thresholds and rates 12 rows higher, at Preferences!F34:R44, and
 * Film Pricing!K47 points there. Blank cells are 0. Column H ($1,000) is
 * blank for groups 1–7. Groups 8–10 are blank from $500 through $2,500.
 *
 * Commission in this app stays a flat rate per rep. This table is only
 * the customer bulk discount.
 *
 * HLOOKUP approximate match: the greatest threshold less than or equal
 * to the film total. Pricing group 0, or anything outside 1–10, is no discount.
 */

export const BULK_FILM_DISCOUNT_LABEL = "Bulk film discount";

/** Film-total dollar thresholds. Header row of the workbook table. */
export const BULK_FILM_THRESHOLDS = [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 20000, 50000] as const;

/** Groups 1–7. Blank workbook cells are 0. */
export const BULK_FILM_RATES_GROUPS_1_TO_7 = [0, 0, 0, 0.02, 0.05, 0.07, 0.09, 0.12, 0.14, 0.15, 0.16, 0.17, 0.17] as const;

/** Groups 8–10. 0 below $3,000. */
export const BULK_FILM_RATES_GROUPS_8_TO_10 = [0, 0, 0, 0, 0, 0, 0.02, 0.04, 0.06, 0.07, 0.08, 0.09, 0.10] as const;

export interface BulkFilmDiscountResult {
  amount: number;
  rate: number;
  /** "Bulk film discount" when a discount applies, otherwise empty. */
  label: string;
}

export function bulkFilmRate(highestPg: number, filmTotal: number): number {
  if (!(filmTotal > 0) || !(highestPg >= 1)) return 0;
  const rates = highestPg <= 7
    ? BULK_FILM_RATES_GROUPS_1_TO_7
    : highestPg <= 10
      ? BULK_FILM_RATES_GROUPS_8_TO_10
      : null;
  if (!rates) return 0;
  let index = 0;
  for (let i = 0; i < BULK_FILM_THRESHOLDS.length; i++) {
    if (filmTotal >= BULK_FILM_THRESHOLDS[i]) index = i;
  }
  return rates[index] ?? 0;
}

export function bulkFilmDiscount(input: {
  filmTotal: number;
  highestPg: number;
  /** Workbook checkbox I47. Defaults on. */
  enabled?: boolean;
}): BulkFilmDiscountResult {
  const none: BulkFilmDiscountResult = { amount: 0, rate: 0, label: "" };
  if (input.enabled === false) return none;
  const rate = bulkFilmRate(input.highestPg, input.filmTotal);
  if (!(rate > 0)) return none;
  const amount = Math.round((input.filmTotal * rate + Number.EPSILON) * 100) / 100;
  if (!(amount > 0)) return none;
  return { amount, rate, label: BULK_FILM_DISCOUNT_LABEL };
}

export function formatDiscountPercent(rate: number): string {
  const pct = Math.round(rate * 1000) / 10;
  return Number.isInteger(pct) ? `${pct.toFixed(0)}%` : `${pct}%`;
}

/**
 * Post-film-total math shared by the calculator, the proposal, and Zoho.
 *
 * Order: film total (after the $250 minimum) → bulk film discount →
 * manual discount % → attachment/other and additional charges → fee.
 * Install-only quotes skip the bulk film discount because no film is sold.
 * The labor amount itself is the film total the caller already calculated
 * from the pricing-group $/SF.
 *
 * Over/under commission matches getOverUnderComm in pricingData.ts:
 * overage uses the rep's rate, a loss is split 50/50.
 */
export function quoteAdjustments(input: {
  filmTotal: number;
  highestPg: number;
  installOnly: boolean;
  /** Rep toggle, same as workbook checkbox I47. Defaults on. */
  bulkDiscountEnabled?: boolean;
  discountEnabled: boolean;
  discountPct: number;
  attachmentOther: number;
  additionalCharges: number;
  feePct: number;
  deposit: number;
  commRate: number | null;
  chargedToClient: number | null;
}): {
  bulkDiscount: number;
  bulkDiscountRate: number;
  bulkDiscountLabel: string;
  discountPctNum: number;
  discount: number;
  additionalCharges: number;
  subtotalAfterDiscount: number;
  feePctNum: number;
  feeAmount: number;
  totalCost: number;
  depositAmt: number;
  balanceDue: number;
  baseCommission: number | null;
  difference: number;
  overUnderComm: number;
  totalCommission: number | null;
} {
  const filmTotal = input.filmTotal > 0 ? input.filmTotal : 0;
  const bulk = input.installOnly
    ? { amount: 0, rate: 0, label: "" }
    : bulkFilmDiscount({
        filmTotal,
        highestPg: input.highestPg,
        enabled: input.bulkDiscountEnabled !== false,
      });
  const discountPctNum = input.discountEnabled && Number.isFinite(input.discountPct) ? input.discountPct : 0;
  const discount = filmTotal * (discountPctNum / 100);
  const additionalCharges = Number.isFinite(input.additionalCharges) ? input.additionalCharges : 0;
  const attachmentOther = Number.isFinite(input.attachmentOther) ? input.attachmentOther : 0;
  const subtotalAfterDiscount = Math.max(0, filmTotal - bulk.amount - discount + attachmentOther + additionalCharges);
  const feePctNum = Number.isFinite(input.feePct) ? input.feePct : 0;
  const feeAmount = subtotalAfterDiscount * (feePctNum / 100);
  const totalCost = subtotalAfterDiscount + feeAmount;
  const depositAmt = Number.isFinite(input.deposit) ? input.deposit : 0;
  const balanceDue = totalCost - depositAmt;
  const baseCommission = input.commRate != null ? subtotalAfterDiscount * input.commRate : null;
  const charged = input.chargedToClient;
  const difference = charged != null && Number.isFinite(charged) ? charged - totalCost : 0;
  const overUnderComm = input.commRate == null ? 0 : difference > 0 ? difference * input.commRate : difference * 0.5;
  const totalCommission = baseCommission != null ? baseCommission + overUnderComm : null;

  return {
    bulkDiscount: bulk.amount,
    bulkDiscountRate: bulk.rate,
    bulkDiscountLabel: bulk.label,
    discountPctNum,
    discount,
    additionalCharges,
    subtotalAfterDiscount,
    feePctNum,
    feeAmount,
    totalCost,
    depositAmt,
    balanceDue,
    baseCommission,
    difference,
    overUnderComm,
    totalCommission,
  };
}
