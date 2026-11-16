import assert from "node:assert/strict";
import { test } from "node:test";
import { additionalChargeHeading, pricedAdditionalCharges } from "./additionalCharges.ts";
import { planEstimateLines } from "./estimateLines.ts";

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
