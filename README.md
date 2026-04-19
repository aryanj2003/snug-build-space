# Aegis Voice Intake

A real-time, voice-driven dispute intake console for card chargebacks. Aegis turns a phone-style conversation into a network-ready, audit-grade dispute case in under 30 seconds — with **zero card digits ever spoken or stored**.

> Built on TanStack Start + React 19 + Lovable Cloud (Supabase). Voice powered by ElevenLabs Conversational AI.

---

## Why this exists

Traditional bank dispute intake is slow, repetitive, and leaks PII. Callers are asked to read out card numbers, last 4, billing addresses — data the bank already has on file. Aegis flips the model:

- The caller is **pre-authenticated** to their account (modeled).
- The agent only collects the **transaction fingerprint**: `merchant + amount + transaction_date`.
- The backend resolves the card-on-file (last 4, network, name) from a deterministic account lookup.
- The case is classified, scored for completeness, routed to a vendor, and committed with a hash-chained audit trail.

The result: a faster, more compliant, more realistic chargeback flow that still produces the exact fields Visa / Mastercard / Amex / Discover require on the chargeback submission.

---

## Features

- 🎙️ **Live voice intake** via ElevenLabs Workflow Agent (WebSocket).
- 🧠 **Deterministic state machine** — one question per turn, structured tool calls (`capture_field`, `mark_dispute_reason`, `finalize_intake`).
- 🔒 **Minimal-PII**: no card number, CVV, last 4, SSN, DOB, billing address, or full legal name collected from the caller.
- 🧾 **ISO-20022-style JSON** output, syntax-highlighted in real time.
- 🔗 **Hash-chained audit ledger** (`prev_hash → hash`) for tamper-evident case history.
- 🧮 **Completeness scoring**, classification confidence, and rule-based vendor routing.
- 🎛️ **Trace highlighting** — hover a field in the ledger to see where it appeared in the transcript.
- 📊 **Live waveform** visualization of the mic stream.
- 🧪 **Simulation mode** — replay a scripted "Sarah" demo call without touching a real microphone.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start v1 (React 19, SSR via Vite 7) |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Styling | Tailwind CSS v4 + semantic tokens in `src/styles.css` (oklch) |
| UI primitives | shadcn/ui |
| Backend | Lovable Cloud (Supabase: Postgres, Auth, RLS) |
| Voice | ElevenLabs Conversational AI (`@elevenlabs/react`) |
| Deploy target | Cloudflare Workers (edge SSR) |
| Tests | Vitest + fast-check (property-based) |

---

## Getting started

```bash
npm install
npm run dev
```

The app boots at `http://localhost:5173`. Lovable Cloud (Supabase) is wired automatically — no `.env` setup required for the public client.

### ElevenLabs agent

To enable live voice (vs. simulation only):

1. Create a **Workflow Agent** in the ElevenLabs dashboard.
2. Register the three client tools defined in `src/lib/aegis/agentSchema.ts`.
3. Configure the workflow nodes per [`AGENT_SETUP.md`](./AGENT_SETUP.md).
4. Set the agent ID in your environment.

### Scripts

```bash
npm run dev      # local dev server
npm run build    # production build
npm run test     # vitest (unit + property-based)
npm run lint     # eslint
```

---

## Architecture

```
src/
├── routes/                  # TanStack file-based routes
│   ├── __root.tsx           # html shell + providers
│   └── index.tsx            # IntakePage — voice + ledger
├── components/aegis/        # Domain UI (CallStream, EnforcementLedger, Waveform, …)
├── lib/aegis/
│   ├── types.ts             # CaseDraft, CaptureField, NetworkType, …
│   ├── agentSchema.ts       # JSON schemas for ElevenLabs client tools
│   ├── cardOnFile.ts        # Deterministic mock account lookup
│   ├── completeness.ts      # Required-field scoring
│   ├── router.ts            # Vendor routing rules
│   ├── classify.ts (server) # Reason classification
│   ├── commit.ts            # Persist case + append audit chain
│   ├── hashChain.ts         # SHA-256 prev_hash → hash linkage
│   ├── iso20022.ts          # JSON projection
│   ├── redact.ts            # PII guards
│   └── simulatedCall.ts     # Sarah demo script
├── server/                  # createServerFn endpoints (classify, ElevenLabs)
└── integrations/supabase/   # Auto-generated client + types
```

### Data flow

1. **Caller speaks** → ElevenLabs streams transcript + invokes client tools.
2. **`capture_field`** updates the `CaseDraft` (merchant, amount, date, …).
3. **`mark_dispute_reason`** classifies the dispute with a confidence score.
4. **`finalize_intake`** triggers:
   - `resolveCardOnFile(draft)` → derives last4, network, name from the fingerprint.
   - `scoreCompleteness(draft)` → required-field check.
   - `routeCase(...)` → matches a vendor + reason code.
   - `commitCase(...)` → inserts case + appends hash-chained audit events.
5. **UI** updates the ledger, ISO-20022 panel, and audit trail in real time.

---

## Security & privacy

- **No card digits collected**: caller-provided fields are limited to `merchant`, `amount_cents`, `transaction_date`, optional `transaction_city` / `approx_time_of_day`, and a one-sentence `description`.
- **Card-on-file values** (`last4`, `network`, `customer_name`, `customer_contact_masked`) are resolved server-side and tagged as `account_lookup` — never spoken.
- **Hash-chained audit log** (`audit_events.prev_hash → hash`) makes any post-hoc tampering detectable.
- **Row-Level Security** on every table; sessions use anonymous auth scoped per browser.
- **Redaction guards** (`src/lib/aegis/redact.ts`) strip accidental PII from transcripts before persistence.

---

## Testing

```bash
npm run test
```

The suite includes:

- **Pure-function unit tests** for `completeness`, `hashChain`, `redact`, `router`, `iso20022`.
- **Property-based tests** (fast-check) verifying that memoization and debouncing in the UI layer never alter the output of pure scoring / pattern / projection functions.
- **Bug-condition regression tests** pinning known-broken behaviors that must stay fixed.

---

## Project conventions

- **No raw color classes** in components — use semantic tokens from `src/styles.css`.
- **No edits** to `src/integrations/supabase/{client,types}.ts` or `src/routeTree.gen.ts` (auto-generated).
- **File-based routing** in `src/routes/` (flat dot-separated). Never use `src/pages/`.
- **Server work** lives in `src/server/*.functions.ts` via `createServerFn`.

---

## License

Proprietary — demo project. All rights reserved.
