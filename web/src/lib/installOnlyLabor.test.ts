import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INSTALL_ONLY_RATE_PER_SQ_FT,
  exactWindowSqFt,
  installOnlyLaborTotal,
} from "./pricingData.ts";

test("install-only labor is $10 per exact measured square foot", () => {
  assert.equal(INSTALL_ONLY_RATE_PER_SQ_FT, 10);
  // 36 × 48 inches is 12.00 exact SF. Roll waste would bill more than that.
  const exact = exactWindowSqFt(36, 48, 1);
  assert.equal(exact, 12);
  assert.equal(installOnlyLaborTotal(exact), 120);
});

test("install-only area is not raised to the 8 inch film minimum", () => {
  const exact = exactWindowSqFt(4, 4, 1);
  assert.equal(exact, 16 / 144);
  assert.equal(installOnlyLaborTotal(exact), (16 / 144) * 10);
});
