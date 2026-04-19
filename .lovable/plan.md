

This is a research question, not an implementation task. Answering directly with the analysis the user asked for.

## Can we file a chargeback with ZERO card digits?

Short answer: **yes** — the last 4 isn't strictly required for *intake*. It's required by the *network* (Visa/MC/Amex/Discover) when the dispute is actually filed, but the **bank already knows the last 4** because the caller is authenticated to their account before being routed to dispute intake. We can exploit that.

## The loophole

In every real-world chargeback flow, the caller has **already passed bank authentication** (IVR PIN, app login, or agent ID-verification) before reaching dispute intake. The bank's core system already has:
- Full card number (we never see it)
- Last 4 (already on the account record)
- Cardholder name
- Billing address
- All recent transactions with merchant + amount + date + MCC code

So instead of asking the caller for identifying card data, we ask for **transaction-identifying data** and let the backend match it to the card on file. The bank does the lookup; we never touch PAN data at all.

## Replacement field set (zero card digits)

Drop `last4` and `network` from the caller-provided fields. Replace with **transaction fingerprint** fields the caller can answer from memory or their statement:

| New field | Why it's enough |
|---|---|
| `merchant` (already have) | Primary match key |
| `amount_cents` (already have) | Secondary match key — exact amount narrows to ~1 txn |
| `transaction_date` ± 2 days (already have) | Tertiary match — merchant+amount+date window = unique txn 99% of the time |
| `customer_name` (already have) | Account lookup |
| `account_last4` (NEW, optional) | Last 4 of **checking/account number**, not card — less sensitive, often public on checks |
| `approx_time_of_day` (NEW, optional) | "morning / afternoon / evening" — disambiguates duplicate-amount days |
| `transaction_city` (NEW, optional) | "It was at the Starbucks on Main St" — disambiguates chain merchants |

The triple **(merchant + amount + date)** is mathematically unique for a given cardholder more than 99% of the time. The bank's transaction table can find the exact charge — and from that record, the system already has the card, last 4, network, MCC, terminal ID, and authorization code. We get **more** data than before, with **less** PII collected.

## How it maps to dispute filing requirements

Networks actually require these on the chargeback submission:
- Card number (on file at bank ✅)
- Transaction amount (caller provides ✅)
- Transaction date (caller provides ✅)
- Merchant ID (derived from txn record ✅)
- Reason code (we classify ✅)
- Cardholder statement (we capture as `description` ✅)

Last 4 and network were **convenience fields for the demo** — not regulatory requirements for intake. The real bank flow never asks for them because they're already known.

## Secondary loophole: voice-biometric pre-auth

ElevenLabs' agent already has the audio stream. Many banks (Chase, Citi, Wells Fargo) use **voice biometrics** as a passive auth factor — the first 6 seconds of speech identify the caller against a stored voiceprint. If we model that the caller is pre-authed, we can drop `customer_name` too and just confirm "Am I speaking with [name on file]?" — the caller answers yes/no, and we never collect their name as input data.

## Tertiary loophole: "the charge in question" pattern

Real bank IVRs often start with: *"I see a $84.70 charge at Starbucks on April 14th — is that the one you're disputing?"* The bank pre-loads the most recent suspicious transactions (failed CVV, geographic anomaly, new merchant) and lets the caller just say **yes**. In that flow we collect literally **zero new fields** — just a confirmation and the dispute reason.

## Recommended minimal field set

For maximum PII reduction while keeping the demo realistic:

**Required (3 fields):**
- `merchant`
- `amount_cents`
- `transaction_date`
- `dispute_reason` (classified)

**Optional disambiguators (only ask if the above three don't uniquely match):**
- `transaction_city`
- `approx_time_of_day`

**Drop entirely:**
- `last4` ❌ (bank has it)
- `network` ❌ (derivable from card on file)
- `customer_name` ❌ (account is pre-authed)
- `customer_contact_masked` ❌ (already on file)

This is **more compliant, faster (under 30 seconds), and more realistic** than the current flow.

## What this would change in the app

If you want to implement it, the changes would be:

1. **`src/lib/aegis/types.ts`** — add `transaction_city`, `approx_time_of_day` to `CaptureField` union; mark `last4`, `network`, `customer_name` as optional
2. **`src/lib/aegis/completeness.ts`** — change required-fields list to the new 3-field minimum
3. **`src/lib/aegis/router.ts`** — derive `network` from a mock "card on file" lookup keyed by `customer_name` instead of taking it as input
4. **`src/lib/aegis/agentSchema.ts`** — update `capture_field` enum
5. **`AGENT_SETUP.md`** — rewrite the workflow nodes for the new minimal flow
6. **`src/components/aegis/EnforcementLedger.tsx`** — show the bank-derived fields (last4, network) in a new "Resolved from account" section so the demo still looks rich
7. **`src/lib/aegis/simulatedCall.ts`** — update Sarah demo to never speak card digits

No schema migration needed — all existing columns stay; we just stop populating `last4`/`network` from caller input and populate them from a simulated account lookup instead.

## Bottom line

The "loophole" is that **the bank already knows everything about the card** — we were asking the caller for data the system already has. By switching to a **transaction-fingerprint** model (merchant + amount + date), we get the same dispute filed with **zero card digits collected**, faster calls, and a stronger compliance story for the demo.

Want me to implement the minimal-PII version?

