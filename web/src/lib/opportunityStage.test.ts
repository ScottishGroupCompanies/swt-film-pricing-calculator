import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NEW_OPPORTUNITY_STAGE,
  OPPORTUNITY_STAGES,
  resolveOpportunityStage,
} from "./opportunityStage.ts";

test("the stage list is the verified Zoho display values, defaulting to Discovery", () => {
  assert.deepEqual(OPPORTUNITY_STAGES, [
    "Discovery",
    "DNQ",
    "Proposal",
    "Closed Won",
    "Closed Lost",
  ]);
  assert.equal(NEW_OPPORTUNITY_STAGE, "Discovery");
  assert.equal(resolveOpportunityStage(undefined), "Discovery");
  assert.equal(resolveOpportunityStage(""), "Discovery");
});

test("each picklist display value is sent unchanged", () => {
  for (const stage of OPPORTUNITY_STAGES) {
    assert.equal(resolveOpportunityStage(stage), stage);
  }
});

test("old actual values are not sent", () => {
  assert.equal(resolveOpportunityStage("Qualification"), "Discovery");
  assert.equal(resolveOpportunityStage("Value Proposition"), "Discovery");
  assert.equal(resolveOpportunityStage("Closed Lost to Competition"), "Discovery");
});
