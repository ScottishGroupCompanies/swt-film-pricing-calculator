import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryIdempotencyStore, oncePerSubmission, useIdempotencyStore } from "./idempotency.ts";
import { friendlyZohoMessage } from "./zohoTransport.ts";

test("two overlapping sends share one Zoho create", async () => {
  useIdempotencyStore(memoryIdempotencyStore());
  let creates = 0;
  const run = () => oncePerSubmission("amy:deal:abc", async () => {
    creates += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { httpStatus: 200, body: { success: true, dealId: "deal-1" } };
  });
  const [first, second] = await Promise.all([run(), run()]);
  assert.equal(creates, 1);
  assert.equal(first.body.dealId, "deal-1");
  assert.equal(second.body.dealId, "deal-1");
  const third = await run();
  assert.equal(creates, 1);
  assert.equal(third.body.dealId, "deal-1");
});

test("a failed send can be retried", async () => {
  useIdempotencyStore(memoryIdempotencyStore());
  let creates = 0;
  const fail = await oncePerSubmission("amy:deal:retry", async () => {
    creates += 1;
    return { httpStatus: 500, body: { success: false, dealId: null } };
  });
  assert.equal(fail.body.success, false);
  const again = await oncePerSubmission("amy:deal:retry", async () => {
    creates += 1;
    return { httpStatus: 200, body: { success: true, dealId: "deal-2" } };
  });
  assert.equal(creates, 2);
  assert.equal(again.body.dealId, "deal-2");
});

test("Crm_Implied_Api_Access is explained without the raw payload", () => {
  const message = friendlyZohoMessage(403, {
    code: "NO_PERMISSION",
    message: "permission denied: Crm_Implied_Api_Access",
  }, "Zoho CRM API error");
  assert.match(message, /Crm_Implied_Api_Access/);
  assert.match(message, /Zoho admin/);
  assert.doesNotMatch(message, /NO_PERMISSION/);
});
