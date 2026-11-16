/** Extra quote lines a rep adds on top of window film. */

export type AdditionalChargeKind = "equipment" | "travel" | "other";

export interface AdditionalCharge {
  id: string;
  kind: AdditionalChargeKind;
  description: string;
  /** Dollar amount as typed. Empty or non-numeric counts as zero. */
  amount: string;
}

export const ADDITIONAL_CHARGE_LABELS: Record<AdditionalChargeKind, string> = {
  equipment: "Equipment",
  travel: "Travel",
  other: "Other",
};

export const ADDITIONAL_CHARGE_DEFAULTS: Record<AdditionalChargeKind, string> = {
  equipment: "Equipment",
  travel: "Travel (trip charge)",
  other: "",
};

export function additionalChargeAmount(charge: { amount: string }): number {
  const n = parseFloat(charge.amount);
  return Number.isFinite(n) ? n : 0;
}

export function sumAdditionalCharges(charges: { amount: string }[]): number {
  return charges.reduce((sum, charge) => sum + additionalChargeAmount(charge), 0);
}

/** Lines with a positive amount, in the order the rep entered them. */
export function pricedAdditionalCharges<T extends { description: string; amount: string; kind: AdditionalChargeKind }>(
  charges: T[],
): { name: string; description: string; amount: number }[] {
  const lines: { name: string; description: string; amount: number }[] = [];
  for (const charge of charges) {
    const amount = Math.round((additionalChargeAmount(charge) + Number.EPSILON) * 100) / 100;
    if (!(Math.abs(amount) > 0)) continue;
    const name = ADDITIONAL_CHARGE_LABELS[charge.kind] || "Other";
    const description = charge.description.trim() || name;
    lines.push({ name, description, amount });
  }
  return lines;
}
