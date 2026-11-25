/**
 * Film Pricing sheet math from ScottishPricing-26_12-Accounts.xlsm.
 *
 * Order, matching the previous calculator:
 * 1. Charged square feet from the Film Pricing sheet (rows 26–41).
 * 2. Sell rate: the workbook Price_Group rate, with group 7 replaced by
 *    $28.40 (owner's V-10.8 rate), then multiplied by SELL_RATE_MARKUP.
 * 3. Line total = charged square feet × that sell rate.
 * 4. Bulk discount is a percent of the film total (those lines, plus removal
 *    and French panes when a caller passes them).
 * 5. Attachment, other charges, and a typed percent discount.
 * 6. The 4% fee on that subtotal.
 *
 * The 3% is not applied again to the fee or the discount. The $250 job
 * minimum and the 8" minimum side are stained-glass Window Pricing rules.
 * Film Pricing formulas do not use them, and neither does this engine.
 *
 * Rows 16–25 of the sheet use a shorter column T that ignores a height gang.
 * That split is covered by the workbook test.
 */

import {
  BULK_DISCOUNT_RATES,
  BULK_DISCOUNT_THRESHOLDS,
  PRICING_GROUP_RATES,
  WORKBOOK_CBOND_PER_CHARGED_SQ_FT,
  WORKBOOK_FEE_RATE,
  WORKBOOK_FRENCH_PANE_EACH,
  WORKBOOK_REMOVAL_PER_SQ_FT,
} from "./catalog.ts";

export const ROLL_WIDTHS = [36, 48, 60, 72, 84, 96, 108, 120, 144] as const;

export type CutMethod = "per-pane-width" | "per-pane-height" | "gang-width" | "gang-height";

export interface ChargedArea {
  chargedSqFt: number;
  rollWidth: number;
  method: CutMethod;
}

function rollWidthFor(spanInches: number): number {
  for (const width of ROLL_WIDTHS) {
    if (spanInches <= width) return width;
  }
  return 144;
}

/** One roll run. Same nested <= comparisons as Film Pricing columns R, S, and T. */
export function rollRunSqFt(spanInches: number, lengthInches: number): number {
  return (rollWidthFor(spanInches) * lengthInches) / 144;
}

/**
 * Rows 16–25 stop here. Column T is the text "oops" once the panes do not
 * fit across a 72" roll, and MIN ignores that text.
 */
export function chargedAreaShort(widthInches: number, heightInches: number, qty: number): ChargedArea | null {
  return chargedAreaFrom(widthInches, heightInches, qty, false);
}

/** Rows 26–41. Column T also tries ganging along the height. */
export function chargedArea(widthInches: number, heightInches: number, qty: number): ChargedArea | null {
  return chargedAreaFrom(widthInches, heightInches, qty, true);
}

function chargedAreaFrom(
  widthInches: number,
  heightInches: number,
  qty: number,
  allowHeightGang: boolean,
): ChargedArea | null {
  if (!(widthInches > 0) || !(heightInches > 0) || !(qty > 0)) return null;
  const w1 = widthInches + 1;
  const h1 = heightInches + 1;
  const options: ChargedArea[] = [
    { chargedSqFt: qty * rollRunSqFt(w1, h1), rollWidth: rollWidthFor(w1), method: "per-pane-width" },
    { chargedSqFt: qty * rollRunSqFt(h1, w1), rollWidth: rollWidthFor(h1), method: "per-pane-height" },
  ];
  if (qty * w1 <= 72) {
    options.push({
      chargedSqFt: rollRunSqFt(qty * w1, h1),
      rollWidth: rollWidthFor(qty * w1),
      method: "gang-width",
    });
  } else if (allowHeightGang && qty * h1 <= 72) {
    options.push({
      chargedSqFt: rollRunSqFt(qty * h1, w1),
      rollWidth: rollWidthFor(qty * h1),
      method: "gang-height",
    });
  }
  return options.reduce((best, option) => (option.chargedSqFt < best.chargedSqFt ? option : best));
}

/** Blank HLOOKUP cells are 0. A group outside 1–10 does not match a table row. */
export function bulkDiscountRate(pricingGroup: number, filmTotal: number): number {
  if (!(filmTotal > 0) || !(pricingGroup >= 1 && pricingGroup <= 10)) return 0;
  const rates = BULK_DISCOUNT_RATES[pricingGroup];
  if (!rates) return 0;
  let index = -1;
  for (let i = 0; i < BULK_DISCOUNT_THRESHOLDS.length; i++) {
    if (filmTotal >= BULK_DISCOUNT_THRESHOLDS[i]) index = i;
  }
  if (index < 0) return 0;
  const rate = rates[index];
  return rate == null ? 0 : rate;
}

/**
 * Added to every group's sell rate before a line is priced.
 * The previous app stored the already-marked-up rates (15.73 × 1.03 = 16.2019,
 * and the same for the other groups). One constant, applied in sellRate().
 */
export const SELL_RATE_MARKUP = 1.03;

/**
 * V-26.12 lists group 7 at $23.40. The owner's V-10.8 workbook sells group 7
 * at $28.40. This replaces the V-26.12 group 7 rate before SELL_RATE_MARKUP.
 * 28.40 × 1.03 = 29.252, which is the rate the previous app charged.
 */
export const GROUP_7_SELL_RATE_BEFORE_MARKUP = 28.4;

/** Sell rates are stored to 4 decimal places, same as the previous app. */
export function roundSellRate(amount: number): number {
  return Math.round(amount * 10000) / 10000;
}

/** Workbook $/SF, after the group 7 override and before the 3% markup. */
export function sellRateBeforeMarkup(pricingGroup: number): number | null {
  if (pricingGroup === 7) return GROUP_7_SELL_RATE_BEFORE_MARKUP;
  const rate = PRICING_GROUP_RATES[pricingGroup];
  return rate == null ? null : rate;
}

/** Dollars per charged square foot actually billed. */
export function sellRate(pricingGroup: number): number | null {
  const base = sellRateBeforeMarkup(pricingGroup);
  if (base == null) return null;
  return roundSellRate(base * SELL_RATE_MARKUP);
}

export const SELL_RATES: Record<number, number> = {};
for (let group = 1; group <= 10; group++) {
  const rate = sellRate(group);
  if (rate != null) SELL_RATES[group] = rate;
}

export function groupRate(pricingGroup: number): number | null {
  return sellRate(pricingGroup);
}

export interface FilmLineInput {
  widthInches: number;
  heightInches: number;
  qty: number;
  /** Null when the row has no film. */
  pricingGroup: number | null;
  /** Rep typed a line total. The sheet has no equivalent cell. */
  lineTotalOverride?: number | null;
}

export interface PricedFilmLine {
  chargedSqFt: number;
  actualSqFt: number;
  rollWidth: number;
  method: CutMethod;
  pricingGroup: number | null;
  ratePerSqFt: number | null;
  lineTotal: number;
}

export interface FilmJobInput {
  lines: FilmLineInput[];
  /** Film Pricing!I47. Default is the checkmark. */
  bulkDiscountEnabled?: boolean;
  /** Film Pricing!J43, square feet of film removal. */
  removalSqFt?: number;
  /** Film Pricing!I44. */
  frenchPanes?: number;
  /** Film Pricing!K46. */
  attachment?: number;
  /** Film Pricing!I48. Default is off. */
  cBond?: boolean;
  /**
   * Not on the Film Pricing sheet. A rep can still type one. Taken off the
   * window-film dollars (not removal or french panes) before the fee.
   */
  manualDiscountPct?: number;
  /** Not on the Film Pricing sheet. Added with the attachment, inside the fee. */
  additionalCharges?: number;
  /**
   * Fraction, not a percent. The sheet hardcodes 0.04. The calculator field
   * is a percent and is divided by 100 before it is passed here.
   */
  feeRate?: number;
  deposit?: number;
}

export interface FilmJobPrice {
  lines: PricedFilmLine[];
  /** Sum of window line totals. Film Pricing!K42. */
  windowTotal: number;
  removal: number;
  frenchPanes: number;
  /** K42+K43+K44. The bulk discount looks this number up. */
  filmTotal: number;
  chargedSqFt: number;
  actualSqFt: number;
  /** Film Pricing!M46. */
  highestGroup: number;
  bulkDiscountRate: number;
  /** Positive dollars. The sheet stores the same amount as a negative K47. */
  bulkDiscount: number;
  manualDiscount: number;
  attachment: number;
  additionalCharges: number;
  cBond: number;
  /** Amount the 4% fee is multiplied by. */
  feeBase: number;
  feeRate: number;
  fee: number;
  total: number;
  deposit: number;
  balanceDue: number;
}

export function priceFilmJob(input: FilmJobInput): FilmJobPrice {
  const lines: PricedFilmLine[] = [];
  let windowTotal = 0;
  let chargedSqFt = 0;
  let actualSqFt = 0;
  let highestGroup = 0;

  for (const line of input.lines) {
    const pricingGroup = line.pricingGroup;
    // A film with quantity 0 still sets column M, and MAX includes it.
    if (!(line.widthInches > 0) || !(line.heightInches > 0)) continue;
    if (!(line.qty > 0)) {
      if (pricingGroup != null && pricingGroup > highestGroup) highestGroup = pricingGroup;
      continue;
    }
    const area = chargedArea(line.widthInches, line.heightInches, line.qty);
    if (!area) continue;
    if (pricingGroup != null && pricingGroup > highestGroup) highestGroup = pricingGroup;
    const rate = pricingGroup == null ? null : groupRate(pricingGroup);
    const calculated = rate == null ? 0 : area.chargedSqFt * rate;
    const override = line.lineTotalOverride;
    const lineTotal = override != null && Number.isFinite(override) ? override : calculated;
    const actual = (line.widthInches * line.heightInches * line.qty) / 144;
    lines.push({
      chargedSqFt: area.chargedSqFt,
      actualSqFt: actual,
      rollWidth: area.rollWidth,
      method: area.method,
      pricingGroup,
      ratePerSqFt: rate,
      lineTotal,
    });
    windowTotal += lineTotal;
    chargedSqFt += area.chargedSqFt;
    actualSqFt += actual;
  }

  const removalSqFt = input.removalSqFt && input.removalSqFt > 0 ? input.removalSqFt : 0;
  const removal = removalSqFt * WORKBOOK_REMOVAL_PER_SQ_FT;
  const frenchCount = input.frenchPanes && input.frenchPanes > 0 ? input.frenchPanes : 0;
  const frenchPanes = frenchCount * WORKBOOK_FRENCH_PANE_EACH;
  const filmTotal = windowTotal + removal + frenchPanes;
  const bulkOn = input.bulkDiscountEnabled !== false;
  const rate = bulkOn ? bulkDiscountRate(highestGroup, filmTotal) : 0;
  const bulkDiscount = rate > 0 ? filmTotal * rate : 0;
  const attachment = finite(input.attachment);
  const additionalCharges = finite(input.additionalCharges);
  const cBond = input.cBond ? chargedSqFt * WORKBOOK_CBOND_PER_CHARGED_SQ_FT : 0;
  const manualPct = input.manualDiscountPct && Number.isFinite(input.manualDiscountPct) ? input.manualDiscountPct : 0;
  const manualDiscount = windowTotal * (manualPct / 100);
  const feeBase = filmTotal - bulkDiscount - manualDiscount + attachment + additionalCharges + cBond;
  const feeRate = input.feeRate != null && Number.isFinite(input.feeRate) ? input.feeRate : WORKBOOK_FEE_RATE;
  const fee = feeBase * feeRate;
  const total = feeBase + fee;
  const deposit = finite(input.deposit);
  return {
    lines,
    windowTotal,
    removal,
    frenchPanes,
    filmTotal,
    chargedSqFt,
    actualSqFt,
    highestGroup,
    bulkDiscountRate: rate,
    bulkDiscount,
    manualDiscount,
    attachment,
    additionalCharges,
    cBond,
    feeBase,
    feeRate,
    fee,
    total,
    deposit,
    balanceDue: total - deposit,
  };
}

function finite(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) ? value : 0;
}
