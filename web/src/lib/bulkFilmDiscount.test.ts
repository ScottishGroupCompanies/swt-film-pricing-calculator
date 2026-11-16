import assert from "node:assert/strict";
import { test } from "node:test";
import { BULK_FILM_DISCOUNT, bulkFilmDiscount, type BulkFilmDiscountConfig } from "./bulkFilmDiscount.ts";

const sample: BulkFilmDiscountConfig = {
  enabled: true,
  tiers: [
    { minChargedSqFt: 500, rate: 0.05 },
    { minChargedSqFt: 1000, rate: 0.1 },
  ],
};

test("the shipped config applies no bulk film discount", () => {
  assert.equal(BULK_FILM_DISCOUNT.enabled, false);
  assert.deepEqual(BULK_FILM_DISCOUNT.tiers, []);
  const result = bulkFilmDiscount({ filmTotal: 20000, chargedSqFt: 2000 });
  assert.equal(result.amount, 0);
  assert.equal(result.label, "");
});

test("a filled config stays off while enabled is false", () => {
  const result = bulkFilmDiscount({
    filmTotal: 1000,
    chargedSqFt: 1500,
    config: { enabled: false, tiers: sample.tiers },
  });
  assert.equal(result.amount, 0);
});

test("the highest qualifying charged-square-foot tier wins", () => {
  const under = bulkFilmDiscount({ filmTotal: 800, chargedSqFt: 499.99, config: sample });
  assert.equal(under.amount, 0);

  const five = bulkFilmDiscount({ filmTotal: 1000, chargedSqFt: 500, config: sample });
  assert.equal(five.amount, 50);
  assert.equal(five.label, "5% bulk film discount");

  const ten = bulkFilmDiscount({ filmTotal: 1000, chargedSqFt: 2500, config: sample });
  assert.equal(ten.amount, 100);
  assert.equal(ten.label, "10% bulk film discount");
});
