/**
 * A quote send succeeds only when Zoho created the opportunity.
 * A contact or account without a deal is a failure the rep has to see.
 */
export function zohoSubmitResult(input: {
  dealId: string | null;
  errors: string[];
}): { success: boolean; errors: string[]; status: number } {
  const errors = [...input.errors];
  if (!input.dealId) {
    if (!errors.some((error) => /deal creation failed/i.test(error))) {
      errors.unshift("Deal creation failed: Zoho did not create an opportunity.");
    }
    return { success: false, errors, status: 500 };
  }
  return { success: true, errors, status: 200 };
}
