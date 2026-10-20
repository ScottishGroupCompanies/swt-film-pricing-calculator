/**
 * Turn calculator line items into the amounts that go on a Zoho Books
 * estimate. The Books total has to match the calculator / deal total.
 * Film lines are the raw window prices; the $250 minimum is a separate
 * adjustment the estimate route used to drop, which is why a $260 deal
 * (film bumped to $250 + 4% fee) was invoiced at $100.74.
 */

export interface EstimateSourceLine {
  desc?: string;
  qty?: number;
  film?: string;
  lineTotal: number;
}

export interface PlannedEstimateLine {
  kind: "film" | "minimum" | "adjustment" | "fee";
  /** Books catalog item to look up. Empty means "use the film line's item". */
  itemName: string;
  name: string;
  description: string;
  rate: number;
  quantity: number;
}

export interface PlannedEstimate {
  lines: PlannedEstimateLine[];
  /**
   * Flat amount Books should subtract. Kept off the line items so we never
   * send a negative rate (Books rejects those).
   */
  discount: number;
}

export function money(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function mapFilmToBooksItemName(film: string): string {
  const f = (film || "").toLowerCase();
  if (f.includes("frost") || f.includes("privacy") || f.includes("mist") || f.includes("glacier")) return "Frost/Privacy Film";
  if (f.includes("safety") || f.includes("security") || f.includes("s2400") || f.includes("prestige")) return "Security Film";
  if (f.includes("solar") || f.includes("reflect") || f.includes("neutral") || f.includes("ceramic")) return "Solar Film";
  if (f.includes("graffiti") || f.includes("anti graffiti")) return "Graffiti";
  if (f.includes("bird")) return "Bird Film";
  return "Other Film";
}

function filmRateAndQty(lineTotal: number, qty: number): { rate: number; quantity: number } {
  const quantity = qty > 0 ? qty : 1;
  const rate = money(lineTotal / quantity);
  if (Math.abs(money(rate * quantity) - money(lineTotal)) < 0.001) {
    return { rate, quantity };
  }
  // An uneven split would drift by a cent. Bill the line total once;
  // the description still shows the window count.
  return { rate: money(lineTotal), quantity: 1 };
}

export function planEstimateLines(input: {
  lines: EstimateSourceLine[];
  minAdj?: number | null;
  feeAmount?: number | null;
  feePct?: number | null;
  /** Calculator / deal total (film after minimum, discount, other, plus fee). */
  totalCost?: number | null;
}): PlannedEstimate {
  const planned: PlannedEstimateLine[] = [];

  for (const line of input.lines) {
    const lineTotal = money(line.lineTotal);
    if (!(lineTotal > 0)) continue;
    const qty = line.qty && line.qty > 0 ? line.qty : 1;
    const { rate, quantity } = filmRateAndQty(lineTotal, qty);
    const filmLabel = line.film && line.film !== "—" ? line.film : "Window Film";
    const desc = line.desc || filmLabel;
    planned.push({
      kind: "film",
      itemName: mapFilmToBooksItemName(line.film || ""),
      name: mapFilmToBooksItemName(line.film || ""),
      description: `${desc} (qty ${qty})${line.film && line.film !== "—" ? ` · ${line.film}` : ""}`,
      rate,
      quantity,
    });
  }

  const filmSum = money(planned.reduce((sum, line) => sum + money(line.rate * line.quantity), 0));
  const fee = input.feeAmount != null && input.feeAmount > 0 ? money(input.feeAmount) : 0;
  const base = money(filmSum + fee);

  let delta = 0;
  if (input.totalCost != null && Number.isFinite(input.totalCost)) {
    delta = money(input.totalCost - base);
  } else if (input.minAdj != null && input.minAdj > 0) {
    delta = money(input.minAdj);
  }

  let discount = 0;
  if (delta >= 0.01) {
    const minAdj = input.minAdj != null ? money(input.minAdj) : 0;
    const isMin = minAdj > 0 && Math.abs(delta - minAdj) < 0.02;
    const namedAsMinimum = minAdj > 0 || isMin;
    planned.push({
      kind: namedAsMinimum ? "minimum" : "adjustment",
      itemName: "",
      name: namedAsMinimum ? "Minimum Job Charge" : "Pricing adjustment",
      description: isMin
        ? "Adjustment to meet the minimum job charge."
        : namedAsMinimum
          ? "Includes the minimum job charge adjustment and other calculator adjustments."
          : "Adjustment so the estimate total matches the calculator total.",
      rate: delta,
      quantity: 1,
    });
  } else if (delta <= -0.01) {
    discount = money(Math.abs(delta));
  }

  if (fee > 0) {
    const pct = input.feePct != null && Number.isFinite(input.feePct) ? input.feePct : 4;
    planned.push({
      kind: "fee",
      itemName: "Fee (No Tax)",
      name: "Fee (No Tax)",
      description: `${pct}% fee includes shipping, handling, delivery, and energy surcharge.`,
      rate: fee,
      quantity: 1,
    });
  }

  return { lines: planned, discount };
}

export function plannedEstimateTotal(plan: PlannedEstimate): number {
  return money(plan.lines.reduce((sum, line) => sum + money(line.rate * line.quantity), 0) - plan.discount);
}
