import type { CompletenessResult, CaseDraft } from "./types";

// Minimal-PII required set: transaction fingerprint + classified reason.
// Card identifiers (last4, network, customer_name) are resolved from the
// bank's card-on-file record, not collected from the caller, so they are
// NOT part of the caller-completeness score.
const REQUIRED: Array<keyof CaseDraft> = [
  "merchant",
  "amount_cents",
  "transaction_date",
  "dispute_reason",
];

// Conditional fields: required when reason is set
const CONDITIONAL_BY_REASON: Partial<Record<NonNullable<CaseDraft["dispute_reason"]>, Array<keyof CaseDraft>>> = {
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
