import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEAL_STAGE_PICKLIST,
  stageValueToSend,
} from "../config/reps.ts";
import {
  NEW_OPPORTUNITY_STAGE,
  OPPORTUNITY_STAGES,
  crmOwner,
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

test("Deal.Stage is the display name, not the picklist actual value", () => {
  assert.equal(resolveOpportunityStage("Qualification"), "Discovery");
  assert.deepEqual(
    DEAL_STAGE_PICKLIST.map((entry) => entry.display).sort(),
    [...OPPORTUNITY_STAGES].sort(),
  );
  assert.equal(stageValueToSend("Discovery"), "Discovery");
  assert.equal(stageValueToSend("DNQ"), "DNQ");
  assert.equal(stageValueToSend("Proposal"), "Proposal");
  assert.equal(stageValueToSend("Closed Won"), "Closed Won");
  assert.equal(stageValueToSend("Closed Lost"), "Closed Lost");
  assert.equal(DEAL_STAGE_PICKLIST.find((entry) => entry.display === "Discovery")?.actual, "Qualification");
});

test("the logged-in rep is the Owner on CRM records", () => {
  const amy = "6168763000003573001";
  assert.deepEqual(crmOwner(amy), { id: amy });
  assert.equal(crmOwner(undefined), undefined);
});
