import assert from "node:assert/strict";
import { test } from "node:test";
import { booksLineItemBody } from "./booksEstimatePayload.ts";

test("line items send a blank unit and no discount fields", () => {
  const body = booksLineItemBody({
    itemId: "item-1",
    name: "Solar Film",
    description: "Kitchen (qty 1) · Solar Bronze",
    rate: 180.5,
    quantity: 1,
  });
  assert.equal(body.unit, "");
  assert.equal(body.quantity, 1);
  assert.equal("discount" in body, false);
  assert.equal("discount_type" in body, false);
  assert.equal(JSON.stringify(body).includes("sf"), false);
});