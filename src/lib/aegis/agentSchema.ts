// Source of truth for the ElevenLabs agent's client-tool JSON schemas.
// Paste these into the ElevenLabs dashboard when configuring the workflow agent.
// Keep this file in sync with the handlers in src/routes/index.tsx.
//
// MINIMAL-PII MODE: the agent only collects transaction-fingerprint fields.
// last4, network, customer_name are resolved server-side from the card on file.

import { DISPUTE_REASONS } from "./types";

// Caller-provided fields only. Bank-resolved fields are intentionally absent.
const CALLER_FIELDS = [
  "merchant",
  "amount_cents",
  "currency",
  "transaction_date",
  "transaction_city",
  "approx_time_of_day",
  "description",
] as const;

export const captureFieldSchema = {
  name: "capture_field",
  description:
    "Record a single piece of intake information into the live case draft. Call this as soon as the user provides a value. Only collect transaction-fingerprint fields — never card numbers, CVV, expiry, or full PII.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["field", "value"],
    properties: {
      field: {
        type: "string",
        enum: [...CALLER_FIELDS],
        description: "Which field of the case draft to set.",
      },
      value: {
        // ElevenLabs allows oneOf in tool schemas
        oneOf: [{ type: "string" }, { type: "number" }],
        description:
          "The value. amount_cents must be an integer in cents. transaction_date must be ISO YYYY-MM-DD (resolve relative dates like 'yesterday' before calling). approx_time_of_day must be one of: morning, afternoon, evening, night.",
      },
    },
  },
} as const;

export const markDisputeReasonSchema = {
  name: "mark_dispute_reason",
  description:
    "Set the classified dispute reason once you are confident which category the customer's issue falls into.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["reason"],
    properties: {
      reason: {
        type: "string",
        enum: [...DISPUTE_REASONS],
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Your confidence in the classification, 0 to 1.",
      },
    },
  },
} as const;

export const finalizeIntakeSchema = {
  name: "finalize_intake",
  description:
    "Call ONLY after the customer has confirmed the summary. Triggers card-on-file resolution, classification, routing, and case commit.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
} as const;

export const AGENT_TOOL_SCHEMAS = [
  captureFieldSchema,
  markDisputeReasonSchema,
  finalizeIntakeSchema,
] as const;
