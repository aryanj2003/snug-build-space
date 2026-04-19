

The user wants to improve agent consistency. ElevenLabs "Workflows" (subagents/conditional flows) is the right fit — it lets you script the intake as a deterministic state machine rather than relying on a single freeform prompt.

Two things I can help with:
1. **Configure the Workflow inside ElevenLabs** (done in their dashboard, not in code)
2. **Adapt our app** so the client tools and finalize step still work cleanly with a workflow-driven agent

## Plan

### 1. Workflow design (do this in the ElevenLabs dashboard)

Create a Workflow on the agent with these nodes, each as a separate sub-agent with a tight prompt:

```text
[Start]
   ↓
[Greet & get name]      → tool: capture_field(customer_name)
   ↓
[Get card network]      → tool: capture_field(network)   [VISA/MC/AMEX/DISCOVER]
   ↓
[Get amount + currency] → tool: capture_field(amount_cents, currency)
   ↓
[Get merchant]          → tool: capture_field(merchant)
   ↓
[Get transaction date]  → tool: capture_field(transaction_date)
   ↓
[Get last4]             → tool: capture_field(last4)
   ↓
[Get contact phone]     → tool: capture_field(customer_contact_masked)
   ↓
[Classify reason]       → tool: mark_dispute_reason(reason, confidence)
   ↓
[Confirm summary]       ── user disagrees → loop back to relevant node
   ↓ user confirms
[Finalize]              → tool: finalize_intake()
   ↓
[End]
```

Per-node prompt rules to enforce:
- One question per turn, max ~15 words
- If user gives multiple fields at once, capture all then advance
- Never invent values — if unclear, re-ask once then move on
- Edge transitions: "user_confirmed", "user_corrected", "user_unsure"

### 2. Tool schemas to register in the dashboard

Make sure each client tool has a strict JSON schema so the LLM can't drift:

- `capture_field(field: enum[customer_name,network,amount_cents,currency,merchant,transaction_date,last4,customer_contact_masked,description], value: string|number)`
- `mark_dispute_reason(reason: enum[unauthorized,duplicate,not_received,defective,cancelled_recurring,incorrect_amount,other], confidence: number 0-1)`
- `finalize_intake()` — no params

### 3. Code changes (small)

**`src/routes/index.tsx`** — harden the client-tool handlers so a workflow agent can't break the UI:
- `capture_field`: coerce `amount_cents` to integer, normalize `network`/`currency` to uppercase, validate `transaction_date` as ISO date, ignore unknown field names (return `"unknown_field"` instead of writing junk into the draft)
- `mark_dispute_reason`: validate against the `DisputeReason` enum, clamp confidence to [0,1]
- `finalize_intake`: guard against double-finalize (already finalizing → return `"already_finalizing"`)

**`src/lib/aegis/types.ts`** — export a `DISPUTE_REASONS` and `CAPTURE_FIELDS` const array so the validation in step above stays in sync with the type.

**New: `src/lib/aegis/agentSchema.ts`** — exports the JSON-schema definitions for the 3 client tools as a copy-pasteable block, plus a one-page `AGENT_SETUP.md` with the workflow node prompts. This gives you a single source of truth to paste into the ElevenLabs dashboard.

### 4. What I won't do
- I can't create the workflow inside ElevenLabs for you — that's a dashboard action. I'll give you the exact prompts and tool schemas to paste in.
- No backend/schema changes needed; the existing `capture_field` / `mark_dispute_reason` / `finalize_intake` contract already fits a workflow agent.

### Tech notes
- The `useConversation` hook is workflow-agnostic — the WebSocket transport we're already using works for workflow agents the same way.
- Hardening the tool handlers is the highest-leverage change: most "inconsistency" complaints come from the model passing slightly wrong field names or string amounts that silently corrupt the draft.

