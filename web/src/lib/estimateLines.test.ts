import assert from "node:assert/strict";
import { test } from "node:test";
import { planEstimateLines, plannedEstimateTotal } from "./estimateLines.ts";

test("a job under the $250 minimum estimates the calculator total, not the raw film price", () => {
  // Deal $260 = film bumped from $90.74 to the $250 minimum + 4% fee ($10).
  const lines = planEstimateLines({
    lines: [{ desc: "Living room", qty: 1, film: "Solar Bronze", lineTotal: 90.74 }],
    minAdj: 159.26,
    feeAmount: 10,
    feePct: 4,
    totalCost: 260,
  });

  const minimum = lines.lines.find((line) => line.kind === "minimum");
  assert.ok(minimum);
  assert.equal(minimum?.name, "Minimum Job Charge");
  assert.equal(minimum?.rate, 159.26);
  assert.equal(lines.lines.find((line) => line.kind === "film")?.rate, 90.74);
  assert.equal(lines.lines.find((line) => line.kind === "fee")?.rate, 10);
  assert.equal(lines.discount, 0);
  assert.equal(plannedEstimateTotal(lines), 260);
});

test("a job already over the minimum does not add an adjustment", () => {
  const lines = planEstimateLines({
    lines: [{ desc: "Office", qty: 2, film: "Security", lineTotal: 400 }],
    minAdj: 0,
    feeAmount: 16,
    feePct: 4,
    totalCost: 416,
  });
  assert.equal(lines.lines.some((line) => line.kind === "minimum" || line.kind === "adjustment"), false);
  assert.equal(plannedEstimateTotal(lines), 416);
});

test("totalCost still forces a match when minAdj was not sent", () => {
  const lines = planEstimateLines({
    lines: [{ desc: "Window", qty: 1, film: "Frost", lineTotal: 90.74 }],
    feeAmount: 10,
    totalCost: 260,
  });
  assert.equal(plannedEstimateTotal(lines), 260);
  assert.equal(lines.lines.find((line) => line.kind === "adjustment")?.rate, 159.26);
});

test("a discount that lowers the deal total is a flat discount, and the sum still matches", () => {
  const lines = planEstimateLines({
    lines: [{ desc: "Window", qty: 1, film: "Solar", lineTotal: 400 }],
    minAdj: 0,
    feeAmount: 15.2,
    feePct: 4,
    totalCost: 395.2,
  });
  assert.equal(lines.discount, 20);
  assert.equal(lines.lines.some((line) => line.rate < 0), false);
  assert.equal(plannedEstimateTotal(lines), 395.2);
});
