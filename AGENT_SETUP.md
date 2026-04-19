# Aegis Intake — ElevenLabs Workflow Agent Setup

Configure the agent in the ElevenLabs dashboard as a **Workflow** (not a single freeform prompt). This gives you a deterministic state machine and dramatically improves consistency.

## 1. Global agent settings

- **First message**: `Hi, this is Aegis dispute intake. May I have your name to get started?`
- **Language**: English
- **Voice**: any conversational voice
- **Transport**: WebSocket (already wired in the app)

## 2. Client tools

Register these three tools. The full JSON schemas are exported from `src/lib/aegis/agentSchema.ts` — copy from there to keep them in sync.

| Name | Purpose |
|---|---|
| `capture_field` | Record one field of the draft (`field`, `value`) |
| `mark_dispute_reason` | Set the classified reason + confidence |
| `finalize_intake` | Trigger classify → route → commit. No params. |

## 3. Workflow nodes

Each node is its own sub-agent with a tight prompt. Edges advance once the relevant tool fires successfully.

### Shared rules (put in every node prompt)
- Ask **one** question per turn, max ~15 words.
- If the user volunteers multiple fields, capture them all then move on.
- Never invent values. If unclear, re-ask **once** then move on.
- After capturing, briefly acknowledge ("Got it.") and advance.

### Node prompts

**Greet & get name** → `capture_field(customer_name)`
> Greet the caller warmly. Ask for their full name. Call `capture_field` with `field="customer_name"` and the spoken name as `value`.

**Get card network** → `capture_field(network)`
> Ask which card was used: Visa, Mastercard, Amex, or Discover. Call `capture_field` with `field="network"` and `value` as one of `VISA`, `MC`, `AMEX`, `DISCOVER`.

**Get amount + currency** → `capture_field(amount_cents)` then `capture_field(currency)`
> Ask the disputed amount and currency. Convert to integer cents (e.g. $847.00 → 84700). Call `capture_field` twice: once with `field="amount_cents"` (integer), once with `field="currency"` (3-letter code like `USD`).

**Get merchant** → `capture_field(merchant)`
> Ask the merchant name as it appears on the statement.

**Get transaction date** → `capture_field(transaction_date)`
> Ask the date of the charge. Pass ISO format `YYYY-MM-DD` as `value`.

**Get last4** → `capture_field(last4)`
> Ask the last 4 digits of the card. Pass as a 4-character string.

**Get contact phone** → `capture_field(customer_contact_masked)`
> Ask the best callback phone number. The app masks it automatically.

**Classify reason** → `mark_dispute_reason(reason, confidence)`
> Ask 1–2 short questions to determine the dispute reason. Call `mark_dispute_reason` with one of: `unauthorized`, `product_not_received`, `product_not_as_described`, `duplicate_charge`, `cancelled_recurring`, `credit_not_processed`, `other`. Include your `confidence` (0–1).

**Confirm summary**
> Read back: name, network, amount + currency, merchant, date, last4, dispute reason. Ask "Does that all sound right?" If they correct anything, loop back to the relevant node. If confirmed, advance.

**Finalize** → `finalize_intake()`
> Say "Thanks — filing your case now." Call `finalize_intake` with no arguments.

## 4. Edge transitions

Use these edge labels between nodes:
- `tool_succeeded` — default forward edge after a tool call returns `"ok"`.
- `user_confirmed` — from Confirm summary → Finalize.
- `user_corrected` — from Confirm summary → the relevant earlier node.
- `user_unsure` — re-ask in the same node once, then advance.

## 5. Why this beats a single prompt

A freeform prompt drifts: the model sometimes invents fields, passes strings for numbers, or skips the finalize call. A workflow forces one tool call per node and won't transition until the call succeeds. The app also hardens every tool handler (`src/routes/index.tsx`), so even if the agent misfires, the draft stays clean.
