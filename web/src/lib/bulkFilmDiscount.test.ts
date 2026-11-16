import assert from "node:assert/strict";
import { test } from "node:test";
import { BULK_FILM_DISCOUNT_LABEL, bulkFilmDiscount, bulkFilmRate } from "./bulkFilmDiscount.ts";

test("groups 1–7 stay at 0% through $1,499.99 and step to 2% at $1,500", () => {
  assert.equal(bulkFilmRate(7, 1499.99), 0);
  assert.equal(bulkFilmRate(1, 1499.99), 0);
  assert.equal(bulkFilmRate(7, 1500), 0.02);
  assert.equal(bulkFilmRate(2, 1500), 0.02);
  const under = bulkFilmDiscount({ filmTotal: 1499.99, highestPg: 7 });
  assert.equal(under.amount, 0);
  const at = bulkFilmDiscount({ filmTotal: 1500, highestPg: 7 });
  assert.equal(at.amount, 30);
  assert.equal(at.label, BULK_FILM_DISCOUNT_LABEL);
});

test("group 7 and group 8 diverge at $3,000", () => {
  assert.equal(bulkFilmRate(7, 2999.99), 0.07);
  assert.equal(bulkFilmRate(8, 2999.99), 0);
  assert.equal(bulkFilmRate(7, 3000), 0.09);
  assert.equal(bulkFilmRate(8, 3000), 0.02);
  assert.equal(bulkFilmRate(10, 3000), 0.02);
  assert.equal(bulkFilmDiscount({ filmTotal: 3000, highestPg: 7 }).amount, 270);
  assert.equal(bulkFilmDiscount({ filmTotal: 3000, highestPg: 8 }).amount, 60);
});

test("the top thresholds match the workbook", () => {
  assert.equal(bulkFilmRate(1, 19999.99), 0.16);
  assert.equal(bulkFilmRate(7, 20000), 0.17);
  assert.equal(bulkFilmRate(7, 50000), 0.17);
  assert.equal(bulkFilmRate(8, 19999.99), 0.08);
  assert.equal(bulkFilmRate(10, 20000), 0.09);
  assert.equal(bulkFilmRate(10, 49999.99), 0.09);
  assert.equal(bulkFilmRate(8, 50000), 0.1);
});

test("pricing group 0 and groups outside 1–10 get no discount", () => {
  assert.equal(bulkFilmRate(0, 20000), 0);
  assert.equal(bulkFilmRate(11, 50000), 0);
  assert.equal(bulkFilmDiscount({ filmTotal: 20000, highestPg: 0 }).amount, 0);
});

test("the checkbox defaults on and can be turned off", () => {
  assert.equal(bulkFilmDiscount({ filmTotal: 2000, highestPg: 3 }).rate, 0.05);
  assert.equal(bulkFilmDiscount({ filmTotal: 2000, highestPg: 3, enabled: false }).amount, 0);
});
