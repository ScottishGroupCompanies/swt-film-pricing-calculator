/**
 * Opportunity stages Jenny uses in Zoho CRM, verified read-only against
 * the Deals Stage picklist (display value, which is what the API stores
 * and returns). The picklist's actual_value is the old Zoho name and is
 * not what records use:
 *
 *   Discovery    actual_value Qualification
 *   DNQ          actual_value Closed Lost to Competition
 *   Proposal     actual_value Value Proposition
 *   Closed Lost  actual_value Closed Lost
 *   Closed Won   actual_value Closed Won
 *
 * Sending "Qualification" creates a stage that is not one of those
 * filters. This app used to do that.
 */
export const OPPORTUNITY_STAGES = [
  "Discovery",
  "DNQ",
  "Proposal",
  "Closed Won",
  "Closed Lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

/**
 * Stage written when this app creates an opportunity.
 *
 * Discovery, rather than Proposal: "Send to Zoho Opportunities" creates
 * the deal before the rep fills out the Books estimate. The new record
 * is a job that still has to be worked, not a proposal that has already
 * been delivered.
 */
export const NEW_OPPORTUNITY_STAGE: OpportunityStage = "Discovery";

/** Stage this app wrote before the list above. Kept so older deals can be recognized. */
export const LEGACY_OPPORTUNITY_STAGE = "Qualification";
