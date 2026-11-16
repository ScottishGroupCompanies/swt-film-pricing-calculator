import assert from "node:assert/strict";
import { test } from "node:test";
import { additionalChargeHeading, pricedAdditionalCharges, sumAdditionalCharges } from "./additionalCharges.ts";
import { planEstimateLines } from "./estimateLines.ts";
import { quoteAdjustments } from "./bulkFilmDiscount.ts";
import { FILMS } from "./pricingData.ts";

test("a typed Other description replaces the Other label", () => {
  const [line] = pricedAdditionalCharges([
    { kind: "other", description: "After hours work", amount: "80" },
  ]);
  assert.equal(line?.name, "After hours work");
  assert.equal(line?.description, "After hours work");
  assert.equal(additionalChargeHeading(line!), "After hours work");
  assert.equal(line?.name.includes("Other"), false);
});

test("an Other line with no description keeps the category name", () => {
  const [line] = pricedAdditionalCharges([
    { kind: "other", description: "   ", amount: "15" },
  ]);
  assert.equal(line?.name, "Other");
  assert.equal(additionalChargeHeading(line!), "Other");
});

test("equipment and travel keep their category names", () => {
  const lines = pricedAdditionalCharges([
    { kind: "equipment", description: "Lift", amount: "100" },
    { kind: "travel", description: "Travel (trip charge)", amount: "75" },
  ]);
  assert.equal(additionalChargeHeading(lines[0]!), "Equipment: Lift");
  assert.equal(additionalChargeHeading(lines[1]!), "Travel: Travel (trip charge)");
});

test("the Books estimate uses the typed Other description as the line name", () => {
  const [priced] = pricedAdditionalCharges([
    { kind: "other", description: "After hours work", amount: "80" },
  ]);
  const plan = planEstimateLines({
    lines: [{ desc: "Office", qty: 1, film: "Solar", lineTotal: 400 }],
    charges: [priced!],
    feeAmount: 0,
    totalCost: 480,
  });
  const charge = plan.lines.find((line) => line.kind === "charge");
  assert.equal(charge?.name, "After hours work");
  assert.equal(charge?.description, "After hours work");
});

test("Custom / Other is not a film under Llumar", () => {
  assert.equal(FILMS.some((film) => film.name === "Custom / Other"), false);
  assert.equal(FILMS.some((film) => film.brand === "Llumar" && /custom/i.test(film.name)), false);
});

test("a typed Custom / Other description is its own charge line in the total, fee, and commission", () => {
  const charges = [
    { kind: "custom" as const, description: "Specialty pattern", amount: "120" },
  ];
  const [line] = pricedAdditionalCharges(charges);
  assert.equal(line?.name, "Specialty pattern");
  assert.equal(additionalChargeHeading(line!), "Specialty pattern");
  assert.equal(sumAdditionalCharges(charges), 120);

  const totals = quoteAdjustments({
    filmTotal: 1000,
    highestPg: 2,
    installOnly: false,
    bulkDiscountEnabled: true,
    discountEnabled: false,
    discountPct: 0,
    attachmentOther: 0,
    additionalCharges: sumAdditionalCharges(charges),
    feePct: 4,
    deposit: 0,
    commRate: 0.1,
    chargedToClient: null,
  });
  assert.equal(totals.subtotalAfterDiscount, 1120);
  assert.equal(Math.round(totals.feeAmount * 100) / 100, 44.8);
  assert.equal(totals.baseCommission, 112);
  assert.equal(Math.round(totals.totalCost * 100) / 100, 1164.8);

  const plan = planEstimateLines({
    lines: [{ desc: "Office", qty: 1, film: "Solar", lineTotal: 1000 }],
    charges: [line!],
    feeAmount: totals.feeAmount,
    feePct: 4,
    totalCost: totals.totalCost,
  });
  const booksLine = plan.lines.find((item) => item.kind === "charge");
  assert.equal(booksLine?.name, "Specialty pattern");
  assert.equal(booksLine?.description, "Specialty pattern");
  assert.equal(booksLine?.rate, 120);
});
