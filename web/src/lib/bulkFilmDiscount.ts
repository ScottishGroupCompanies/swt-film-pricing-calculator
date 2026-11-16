/**
 * Bulk film discount.
 *
 * The tiers below are the only place this discount is defined. They are
 * empty and the switch is off because the repository does not contain a
 * film volume-discount schedule that can be applied without guessing.
 *
 * What was searched (V-10.9 price list in pricingData.ts, docs/, git
 * history, and data/ScottishPricing-26_12-Accounts.xlsm):
 *
 * - Film Pricing / Film Pricing Customer / Film Commission have no bulk,
 *   volume, or quantity-break discount. Line price is charged square feet
 *   times the pricing-group $/SF (Price_Group).
 * - Preferences!F34:R44 is the commission-rate table (job-total columns,
 *   pricing-group rows). Film Pricing!K47 uses it only when checkbox I47
 *   is on, as a negative "Other" amount:
 *   HLOOKUP(film total, Preferences!F34:R44, max pricing group + 1) * film
 *   total * -1. The line label becomes "Other". The app already replaced
 *   that checkbox with the manual Discount % and the Attachment/Other
 *   dollar field. Those rates are commission, not a customer film discount.
 *   V-10.9 commission in this app is a flat rate per rep, not that table.
 * - Preferences!A6:B13 ("Cost Per Sq. Ft.", 0 / 7.01 / 15.01 / 20.01 /
 *   25.01 / 28.01 / 32.01 sq ft → $220 / $240 / $270 / $300 / $340 / $420 /
 *   $700) is used by the Window Pricing sheet, and the price goes up with
 *   size. It is not a film discount.
 * - Replacement Windows has a note, "10% discount for 3 or more windows".
 *   That sheet is replacement windows, not film.
 * - Restoration has a "Lift rental discount" label and no film tiers.
 *
 * To turn this on after Jenny confirms a schedule, set `enabled` to true
 * and add tiers. The highest tier whose `minChargedSqFt` is less than or
 * equal to the job's charged square feet wins. `rate` is a fraction of
 * the film total after the $250 minimum (0.1 = 10%). Install-only quotes
 * do not call this — the customer is not buying film.
 */

export interface BulkFilmDiscountTier {
  /** Inclusive minimum charged square feet. */
  minChargedSqFt: number;
  /** Fraction of the film total. 0.1 means 10%. */
  rate: number;
}

export interface BulkFilmDiscountConfig {
  /** Off, or an empty tier list, applies no discount. */
  enabled: boolean;
  tiers: BulkFilmDiscountTier[];
}

export const BULK_FILM_DISCOUNT: BulkFilmDiscountConfig = {
  enabled: false,
  tiers: [],
};

export interface BulkFilmDiscountResult {
  amount: number;
  rate: number;
  /** Customer-facing label, empty when no discount applies. */
  label: string;
}

export function bulkFilmDiscount(input: {
  filmTotal: number;
  chargedSqFt: number;
  config?: BulkFilmDiscountConfig;
}): BulkFilmDiscountResult {
  const config = input.config ?? BULK_FILM_DISCOUNT;
  const none: BulkFilmDiscountResult = { amount: 0, rate: 0, label: "" };
  if (!config.enabled || config.tiers.length === 0) return none;
  if (!(input.filmTotal > 0) || !(input.chargedSqFt > 0)) return none;

  const tier = config.tiers.reduce<BulkFilmDiscountTier | null>((best, candidate) => {
    if (!(candidate.minChargedSqFt >= 0) || !(candidate.rate > 0)) return best;
    if (input.chargedSqFt + 1e-9 < candidate.minChargedSqFt) return best;
    if (!best || candidate.minChargedSqFt >= best.minChargedSqFt) return candidate;
    return best;
  }, null);
  if (!tier) return none;

  const amount = Math.round((input.filmTotal * tier.rate + Number.EPSILON) * 100) / 100;
  if (!(amount > 0)) return none;
  return {
    amount,
    rate: tier.rate,
    label: `${formatDiscountPercent(tier.rate)} bulk film discount`,
  };
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
  chargedSqFt: number;
  installOnly: boolean;
  discountEnabled: boolean;
  discountPct: number;
  attachmentOther: number;
  additionalCharges: number;
  feePct: number;
  deposit: number;
  commRate: number | null;
  chargedToClient: number | null;
  bulkConfig?: BulkFilmDiscountConfig;
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
        chargedSqFt: input.chargedSqFt,
        config: input.bulkConfig,
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
