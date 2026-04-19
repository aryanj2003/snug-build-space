import type { CompletenessResult, CaseDraft } from "./types";

const REQUIRED: Array<keyof CaseDraft> = [
  "network",
  "amount_cents",
  "merchant",
  "transaction_date",
  "last4",
  "customer_name",
  "dispute_reason",
];

// Conditional fields: required when reason is set
const CONDITIONAL_BY_REASON: Partial<Record<NonNullable<CaseDraft["dispute_reason"]>, Array<keyof CaseDraft>>> = {
  unauthorized: ["customer_contact_masked"],
  product_not_received: ["description"],
  product_not_as_described: ["description"],
  cancelled_recurring: ["description"],
};

export function scoreCompleteness(draft: CaseDraft): CompletenessResult {
  const missing: string[] = [];
  for (const f of REQUIRED) {
    const v = draft[f];
    if (v === undefined || v === null || v === "") missing.push(String(f));
  }
  const conditional = draft.dispute_reason
    ? (CONDITIONAL_BY_REASON[draft.dispute_reason] ?? [])
    : [];
  for (const f of conditional) {
    const v = draft[f];
    if (v === undefined || v === null || v === "") missing.push(String(f));
  }
  const total = REQUIRED.length + conditional.length;
  const present = total - missing.length;
  const score = total === 0 ? 1 : Math.max(0, present / total);
  return { score, missing_fields: missing };
}
