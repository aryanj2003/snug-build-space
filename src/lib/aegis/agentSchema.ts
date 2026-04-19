// Source of truth for the ElevenLabs agent's client-tool JSON schemas.
// Paste these into the ElevenLabs dashboard when configuring the workflow agent.
// Keep this file in sync with the handlers in src/routes/index.tsx.

import { CAPTURE_FIELDS, DISPUTE_REASONS, NETWORK_TYPES } from "./types";

export const captureFieldSchema = {
  name: "capture_field",
  description:
    "Record a single piece of intake information into the live case draft. Call this as soon as the user provides a value.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["field", "value"],
    properties: {
      field: {
        type: "string",
        enum: [...CAPTURE_FIELDS],
        description: "Which field of the case draft to set.",
      },
      value: {
        // ElevenLabs allows oneOf in tool schemas
        oneOf: [{ type: "string" }, { type: "number" }],
        description:
          "The value. amount_cents must be an integer in cents. network must be one of " +
          NETWORK_TYPES.join("/") +
          ". transaction_date must be ISO YYYY-MM-DD.",
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
    "Call ONLY after the customer has confirmed the summary. Triggers classification, routing, and case commit.",
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
