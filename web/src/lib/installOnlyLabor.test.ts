import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INSTALL_ONLY_RATE_PER_CHARGED_SF,
  MIN_PRICE,
  installOnlyLaborTotal,
} from "./pricingData.ts";

test("install-only labor is $10 per charged square foot", () => {
  assert.equal(INSTALL_ONLY_RATE_PER_CHARGED_SF, 10);
  assert.equal(installOnlyLaborTotal(12.5), 125);
  assert.equal(installOnlyLaborTotal(0), 0);
});

test("install-only labor still respects the $250 minimum job price", () => {
  const labor = installOnlyLaborTotal(10);
  assert.equal(labor, 100);
  assert.equal(Math.max(labor, MIN_PRICE), MIN_PRICE);
});
