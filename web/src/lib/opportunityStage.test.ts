import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NEW_OPPORTUNITY_STAGE,
  OPPORTUNITY_STAGES,
  crmOwner,
  opportunityStageApiValue,
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

test("the dropdown keeps display names and the API gets the actual value", () => {
  assert.equal(resolveOpportunityStage("Qualification"), "Discovery");
  assert.equal(opportunityStageApiValue("Discovery"), "Qualification");
  assert.equal(opportunityStageApiValue("DNQ"), "Closed Lost to Competition");
  assert.equal(opportunityStageApiValue("Proposal"), "Value Proposition");
  assert.equal(opportunityStageApiValue("Closed Won"), "Closed Won");
  assert.equal(opportunityStageApiValue("Closed Lost"), "Closed Lost");
});

test("the logged-in rep is the Owner on CRM records", () => {
  const amy = "6168763000003573001";
  assert.deepEqual(crmOwner(amy), { id: amy });
  assert.equal(crmOwner(undefined), undefined);
});
