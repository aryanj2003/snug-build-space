// Shared types for Aegis intake. Safe to import on client + server.

export type NetworkType = "VISA" | "MC" | "AMEX" | "DISCOVER" | "OTHER";
export type DisputeReason =
  | "unauthorized"
  | "product_not_received"
  | "product_not_as_described"
  | "duplicate_charge"
  | "cancelled_recurring"
  | "credit_not_processed"
  | "other";
export type CaseStatus = "intake" | "classified" | "routed" | "committed" | "failed";

export interface CaseDraft {
  network?: NetworkType;
  amount_cents?: number;
  currency?: string;
  merchant?: string;
  transaction_date?: string; // ISO date
  last4?: string;
  customer_name?: string;
  customer_contact_masked?: string;
  description?: string;
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
