// Shared types for Aegis intake. Safe to import on client + server.

export const NETWORK_TYPES = ["VISA", "MC", "AMEX", "DISCOVER", "OTHER"] as const;
export type NetworkType = (typeof NETWORK_TYPES)[number];

export const DISPUTE_REASONS = [
  "unauthorized",
  "product_not_received",
  "product_not_as_described",
  "duplicate_charge",
  "cancelled_recurring",
  "credit_not_processed",
  "other",
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

// Minimal-PII intake: caller only provides transaction-fingerprint fields.
// last4, network, customer_name, customer_contact_masked are resolved from
// the bank's "card on file" record (simulated) — not collected from the caller.
export const CAPTURE_FIELDS = [
  "merchant",
  "amount_cents",
  "currency",
  "transaction_date",
  "transaction_city",
  "approx_time_of_day",
  "description",
  // Legacy fields kept for backward-compat with existing components/agent configs.
  // The new workflow should NOT prompt for these, but if an older agent still
  // sends them we accept and store them.
  "customer_name",
  "network",
  "last4",
  "customer_contact_masked",
] as const;
export type CaptureField = (typeof CAPTURE_FIELDS)[number];

export type CaseStatus = "intake" | "classified" | "routed" | "committed" | "failed";

export interface CaseDraft {
  // Caller-provided (transaction fingerprint)
  merchant?: string;
  amount_cents?: number;
  currency?: string;
  transaction_date?: string; // ISO date
  transaction_city?: string;
  approx_time_of_day?: string; // "morning" | "afternoon" | "evening" | "night"
  description?: string;
  // Bank-resolved (from card-on-file lookup, not from the caller)
  network?: NetworkType;
  last4?: string;
  customer_name?: string;
  customer_contact_masked?: string;
  // Classification
  dispute_reason?: DisputeReason;
  classification_confidence?: number;
  raw_transcript?: string;
}

export interface AuditEventInput {
  seq: number;
  event_type:
    | "session_started"
    | "field_captured"
    | "classified"
    | "completeness_scored"
    | "routed"
    | "committed"
    | "verified";
  payload: Record<string, unknown>;
}

export interface RouteResult {
  vendor_id: string;
  vendor_name: string;
  rule_id: string;
  reason_code: string | null;
  scored_alternatives: Array<{ vendor_id: string; vendor_name: string; score: number }>;
}

export interface CompletenessResult {
  score: number;
  missing_fields: string[];
}

export interface ClassifyResult {
  dispute_reason: DisputeReason;
  confidence: number;
}
