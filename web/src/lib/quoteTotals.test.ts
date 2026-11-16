import assert from "node:assert/strict";
import { test } from "node:test";
import { quoteAdjustments } from "./bulkFilmDiscount.ts";
import { getOverUnderComm } from "./pricingData.ts";

const base = {
  filmTotal: 1000,
  highestPg: 2,
  installOnly: false,
  bulkDiscountEnabled: true,
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
    filmTotal: 3000,
    highestPg: 8,
    installOnly: true,
  });
  assert.equal(totals.bulkDiscount, 0);
  assert.equal(totals.subtotalAfterDiscount, 3000);
  assert.equal(totals.feeAmount, 120);
  assert.equal(totals.totalCost, 3120);
});

test("the workbook rate comes off the film total before the fee", () => {
  const totals = quoteAdjustments({ ...base, filmTotal: 1500, highestPg: 7 });
  assert.equal(totals.bulkDiscount, 30);
  assert.equal(totals.bulkDiscountLabel, "Bulk film discount");
  assert.equal(totals.subtotalAfterDiscount, 1470);
  assert.equal(Math.round(totals.feeAmount * 100) / 100, 58.8);
  assert.equal(Math.round(totals.totalCost * 100) / 100, 1528.8);
  assert.equal(totals.baseCommission, 147);
});

test("unchecking the bulk discount leaves the film total intact", () => {
  const totals = quoteAdjustments({
    ...base,
    filmTotal: 3000,
    highestPg: 7,
    bulkDiscountEnabled: false,
  });
  assert.equal(totals.bulkDiscount, 0);
  assert.equal(totals.totalCost, 3120);
});

test("over/under commission matches the Film Commission sheet helper", () => {
  const over = quoteAdjustments({ ...base, chargedToClient: 1200 });
  assert.equal(over.difference, 160);
  assert.equal(over.overUnderComm, getOverUnderComm(160, 0.1));
  const under = quoteAdjustments({ ...base, chargedToClient: 900 });
  assert.equal(under.overUnderComm, getOverUnderComm(under.difference, 0.1));
});
