import assert from "node:assert/strict";
import { test } from "node:test";
import { quoteAdjustments } from "./bulkFilmDiscount.ts";
import { getOverUnderComm } from "./pricingData.ts";

const base = {
  filmTotal: 1000,
  chargedSqFt: 2000,
  installOnly: false,
  discountEnabled: false,
  discountPct: 0,
  attachmentOther: 0,
  additionalCharges: 0,
  feePct: 4,
  deposit: 0,
  commRate: 0.1,
  chargedToClient: null,
};

test("a normal quote still adds the fee on the film total", () => {
  const totals = quoteAdjustments(base);
  assert.equal(totals.bulkDiscount, 0);
  assert.equal(totals.subtotalAfterDiscount, 1000);
  assert.equal(totals.feeAmount, 40);
  assert.equal(totals.totalCost, 1040);
  assert.equal(totals.baseCommission, 100);
});

test("additional charges are in the total and the fee base", () => {
  const totals = quoteAdjustments({ ...base, additionalCharges: 250, attachmentOther: 50 });
  assert.equal(totals.subtotalAfterDiscount, 1300);
  assert.equal(totals.feeAmount, 52);
  assert.equal(totals.totalCost, 1352);
});

test("install-only skips bulk film discount and still prices the fee on labor", () => {
  const totals = quoteAdjustments({
    ...base,
    installOnly: true,
    bulkConfig: { enabled: true, tiers: [{ minChargedSqFt: 100, rate: 0.1 }] },
  });
  assert.equal(totals.bulkDiscount, 0);
  assert.equal(totals.totalCost, 1040);
});

test("an enabled bulk tier reduces the film total before the fee", () => {
  const totals = quoteAdjustments({
    ...base,
    bulkConfig: { enabled: true, tiers: [{ minChargedSqFt: 1000, rate: 0.1 }] },
  });
  assert.equal(totals.bulkDiscount, 100);
  assert.equal(totals.bulkDiscountLabel, "10% bulk film discount");
  assert.equal(totals.subtotalAfterDiscount, 900);
  assert.equal(totals.feeAmount, 36);
  assert.equal(totals.totalCost, 936);
});

test("over/under commission matches the Film Commission sheet helper", () => {
  const over = quoteAdjustments({ ...base, chargedToClient: 1200 });
  assert.equal(over.difference, 160);
  assert.equal(over.overUnderComm, getOverUnderComm(160, 0.1));
  const under = quoteAdjustments({ ...base, chargedToClient: 900 });
  assert.equal(under.overUnderComm, getOverUnderComm(under.difference, 0.1));
});
