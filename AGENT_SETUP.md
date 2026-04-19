# Aegis Intake — ElevenLabs Workflow Agent Setup (Minimal-PII)

Configure the agent in the ElevenLabs dashboard as a **Workflow** (not a single freeform prompt). This gives you a deterministic state machine and dramatically improves consistency.

> **PII minimization:** the agent collects ONLY transaction-fingerprint fields (merchant, amount, date, optional city/time-of-day). It NEVER asks for the card number, last 4, network, full name, or phone. Card identifiers are resolved server-side from the caller's authenticated card-on-file record. See `src/lib/aegis/cardOnFile.ts`.

## 1. Global agent settings

- **First message**: `Hi, this is Aegis dispute intake — I can see your account. Which charge are you disputing?`
- **Language**: English
- **Voice**: any conversational voice
- **Transport**: WebSocket (already wired in the app)

## 2. Client tools

Register these three tools. The full JSON schemas are exported from `src/lib/aegis/agentSchema.ts` — copy from there to keep them in sync.

| Name | Purpose |
|---|---|
| `capture_field` | Record one field of the draft (`field`, `value`). Allowed fields: `merchant`, `amount_cents`, `currency`, `transaction_date`, `transaction_city`, `approx_time_of_day`, `description`. |
| `mark_dispute_reason` | Set the classified reason + confidence |
| `finalize_intake` | Trigger card-on-file resolution → classify → route → commit. No params. |

## 3. Workflow nodes

Each node is its own sub-agent with a tight prompt. Edges advance once the relevant tool fires successfully.

### Shared rules (put in every node prompt)
- Ask **one** question per turn, max ~15 words.
- Wait for the caller to fully finish — even with a 2–3s pause — before re-asking.
- If the user volunteers multiple fields, capture them all, then move on.
- Never invent values. If unclear, re-ask **once**, then move on.
- After capturing, briefly acknowledge ("Got it.") and advance.
- **NEVER** ask for: card number, CVV, expiration, full last 4, billing address, SSN, DOB, phone, email, or full legal name. The bank already has these.
- If the caller starts reading their card number, interrupt politely: *"You can stop there — I don't need the card number."*

### Node prompts

**Greet & ask which charge** → (no tool yet, sets context)
> Greet warmly. Say "I can see your account — which charge are you disputing?"

**Get merchant + amount** → `capture_field(merchant)` then `capture_field(amount_cents)`
> Capture the merchant name and the amount in dollars. Convert to integer cents (e.g. $847.00 → 84700). Also capture `currency` as `USD` if not specified.

**Get transaction date** → `capture_field(transaction_date)`
> Today is {{system__time}}. Resolve relative dates ("yesterday", "last Friday", "two days ago") to ISO `YYYY-MM-DD` BEFORE calling the tool. Read back in long form ("April 14th — correct?") to confirm.

**Get time of day (optional)** → `capture_field(approx_time_of_day)`
> Ask: "Roughly what time of day — morning, afternoon, evening, or night?" Pass one of: `morning`, `afternoon`, `evening`, `night`. Skip if caller doesn't remember.

**Get city (optional, only if needed)** → `capture_field(transaction_city)`
> Only ask if the merchant is a chain (Starbucks, Walmart, etc.) AND the amount+date alone aren't enough to disambiguate. Otherwise skip.

**Classify reason** → `mark_dispute_reason(reason, confidence)`
> Ask 1–2 short questions to determine the dispute reason. Call `mark_dispute_reason` with one of: `unauthorized`, `product_not_received`, `product_not_as_described`, `duplicate_charge`, `cancelled_recurring`, `credit_not_processed`, `other`. Include `confidence` (0–1).

**Capture short statement** → `capture_field(description)`
> Capture a one-sentence cardholder statement summarizing what happened (e.g. "Customer never received the product"). Required for `product_not_received`, `product_not_as_described`, `cancelled_recurring`.

**Confirm summary**
> Read back: amount + currency, merchant, date (+ time of day if captured), dispute reason. Ask "Does that all sound right?" Do NOT read back card digits or cardholder name — those come from the account record. If they correct anything, loop back.

**Finalize** → `finalize_intake()`
> Say "Thanks — filing your dispute now." Call `finalize_intake` with no arguments.

## 4. Edge transitions

- `tool_succeeded` — default forward edge after a tool call returns `"ok"`.
- `user_confirmed` — from Confirm summary → Finalize.
- `user_corrected` — from Confirm summary → the relevant earlier node.
- `user_unsure` — re-ask in the same node once, then advance (skip optional nodes).

## 5. What happens at finalize

When `finalize_intake` fires, the app:
1. Classifies the transcript if `mark_dispute_reason` wasn't called.
2. Calls `resolveCardOnFile(draft)` — looks up `last4`, `network`, `customer_name`, `customer_contact_masked` from the simulated card-on-file record (in production, this would query the bank's authenticated account).
3. Scores completeness against the minimal required set: `merchant`, `amount_cents`, `transaction_date`, `dispute_reason`.
4. Routes to a dispute vendor and commits the case + audit trail.

## 6. Why this beats the previous prompt

- **Faster**: target under 30s vs 60s — fewer fields to collect.
- **More compliant**: zero card digits ever spoken or transmitted from the caller side.
- **More realistic**: real bank IVRs already authenticate the caller before intake; asking for last 4 over again is friction.
- **Same dispute filed**: networks require card number + amount + date + merchant + reason code on the chargeback submission. The bank already has the card; the caller provides the rest.
