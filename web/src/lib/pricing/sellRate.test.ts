import assert from "node:assert/strict";
import { test } from "node:test";
import { PRICING_GROUP_RATES } from "./catalog.ts";
import {
  GROUP_7_SELL_RATE_BEFORE_MARKUP,
  SELL_RATE_MARKUP,
  SELL_RATES,
  priceFilmJob,
  roundSellRate,
  sellRate,
} from "./engine.ts";

const PREVIOUS_APP_RATES: Record<number, number> = {
  1: 16.2019,
  2: 17.2834,
  3: 18.3649,
  4: 20.4558,
  5: 23.5664,
  6: 26.9139,
  7: 29.252,
  8: 34.5256,
  9: 41.097,
  10: 47.3594,
};

test("every sell rate is the workbook rate times 3 percent, and group 7 starts at 28.40", () => {
  assert.equal(SELL_RATE_MARKUP, 1.03);
  assert.equal(GROUP_7_SELL_RATE_BEFORE_MARKUP, 28.4);
  for (let group = 1; group <= 10; group++) {
    const base = group === 7 ? 28.4 : PRICING_GROUP_RATES[group];
    const billed = sellRate(group);
    assert.equal(billed, roundSellRate(base * SELL_RATE_MARKUP));
    assert.equal(billed, PREVIOUS_APP_RATES[group]);
    assert.equal(SELL_RATES[group], PREVIOUS_APP_RATES[group]);
  }
  assert.equal(PRICING_GROUP_RATES[7], 23.4);
  assert.notEqual(sellRate(7), roundSellRate(23.4 * SELL_RATE_MARKUP));
});

test("a 25 by 30 group 2 window is the workbook line times 1.03, then the 4% fee", () => {
  const quote = priceFilmJob({
    lines: [{ widthInches: 25, heightInches: 30, qty: 1, pricingGroup: 2 }],
  });
  assert.equal(quote.lines[0].chargedSqFt, 6.5);
  assert.equal(quote.lines[0].lineTotal, 6.5 * 17.2834);
  assert.ok(Math.abs(quote.lines[0].lineTotal - 109.07 * 1.03) < 1e-9);
  assert.equal(quote.bulkDiscount, 0);
  assert.equal(quote.fee, quote.filmTotal * 0.04);
  assert.equal(quote.total, quote.filmTotal + quote.fee);
});

test("a 25 by 30 group 7 window uses 29.252 per square foot", () => {
  const quote = priceFilmJob({
    lines: [{ widthInches: 25, heightInches: 30, qty: 1, pricingGroup: 7 }],
  });
  assert.equal(quote.lines[0].chargedSqFt, 6.5);
  assert.equal(quote.lines[0].ratePerSqFt, 29.252);
  assert.equal(quote.lines[0].lineTotal, 6.5 * 29.252);
  assert.equal(quote.fee, quote.filmTotal * 0.04);
});
