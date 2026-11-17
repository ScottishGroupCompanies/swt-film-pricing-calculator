/**
 * Opportunity stages shown in the calculator. The value written to
 * Deal.Stage is the display name from web/src/config/reps.ts. The
 * picklist actual_value (Qualification, and the other old names) is
 * stored as that old name, which is what the deal page shows.
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

/** Display value chosen in the calculator. Unknown input stays Discovery. */
export function resolveOpportunityStage(value: unknown): OpportunityStage {
  if (typeof value === "string" && (OPPORTUNITY_STAGES as readonly string[]).includes(value)) {
    return value as OpportunityStage;
  }
  return NEW_OPPORTUNITY_STAGE;
}

/** Owner lookup written on Contact, Account, and Deal. */
export function crmOwner(ownerZohoUserId?: string): { id: string } | undefined {
  if (!ownerZohoUserId) return undefined;
  return { id: ownerZohoUserId };
}
