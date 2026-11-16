import assert from "node:assert/strict";
import { test } from "node:test";
import { zohoSubmitResult } from "./zohoSubmitResult.ts";

test("a contact without an opportunity is a visible failure", () => {
  const result = zohoSubmitResult({
    dealId: null,
    errors: ["Deal creation failed: Failed to create deal: INVALID_DATA: invalid data"],
  });
  assert.equal(result.success, false);
  assert.equal(result.status, 500);
  assert.match(result.errors[0] || "", /Deal creation failed/);
});

test("a missing deal error is added when the failure was swallowed", () => {
  const result = zohoSubmitResult({ dealId: null, errors: [] });
  assert.equal(result.success, false);
  assert.match(result.errors[0] || "", /did not create an opportunity/);
});

test("an opportunity is a success even if a later sheet warning exists", () => {
  const result = zohoSubmitResult({
    dealId: "deal-1",
    errors: ["ZOHO_SHEET_WORKBOOK_ID not configured — skipping sheet row"],
  });
  assert.equal(result.success, true);
  assert.equal(result.status, 200);
});
