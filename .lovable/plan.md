

# Aegis Intake — MVP Build Plan

A voice-first dispute intake app that turns a phone call into a structured, classified, routed case in under 60 seconds.

## What I'll build

**Backend (Lovable Cloud)**
- Postgres schema: `cases`, `vendor_registry`, `routing_rules`, `audit_events` with the enums and indexes from the spec
- Seed data: 5 vendors (Visa TC40, VROL, MC SAFE, Chargeback911, Internal Ops) + 4 routing rules
- RLS: anonymous sessions, users only read their own cases
- Edge functions:
  - `elevenlabs-token` — server-mints short-lived conversation tokens (keeps API key off client)
  - `classify` — Lovable AI Gateway, JSON-schema-constrained output → `{dispute_reason, confidence}`
  - `score-completeness` — checks required + conditional fields → `{score, missing_fields}`
  - `route` — pure deterministic SQL/JS (filter → first-match rule → tiebreaker scorer), returns `rule_id` + `scored_alternatives`
  - `commit-case` — writes case + hash-chained audit events
  - `verify-chain` — recomputes sha256 chain, returns `{valid}`

**Frontend (single page)**
- Anonymous Supabase sign-in on load
- **Left 60%**: big "Start Call" button → live transcript stream (WebRTC via `@elevenlabs/react` `useConversation`)
- **Right 40%**: "Live Case" card — fields animate in as captured, classification badge with confidence %, completeness progress bar, routed destination
- **Bottom drawer**: collapsible audit trail with timestamps and truncated hashes, plus a "Verify chain" button
- 3 client tools wired to the agent: `capture_field`, `mark_dispute_reason`, `finalize_intake`
- On finalize: runs classify → score → route → commit-case in sequence, renders result

**Security (lightweight, per spec §11)**
- `redact()` util masks card numbers, emails, phones before any log/audit write
- Hash-chained audit events (sha256 of canonical JSON + prev_hash)
- ElevenLabs key stays server-side
- RLS on `cases` and `audit_events`

**Demo target**: VISA, unauthorized, $847 → routes to `V01` with reason code `10.4`, ≥6 audit events with valid chain.

## What I won't build (out of scope per spec)
Human agent dashboards, real Visa API, Stripe, marketing site, Vanta or any compliance vendor, adjudication/refunds.

## Setup notes after approval
1. Lovable Cloud will be enabled automatically and the migration runs on first deploy.
2. The "Start Call" button will show a friendly "Add ElevenLabs credentials to enable voice" state until you provide:
   - `ELEVENLABS_API_KEY` (Cloud secret)
   - `VITE_ELEVENLABS_AGENT_ID` (env var, with the system prompt + 3 client tools configured in the ElevenLabs dashboard per spec §6)
3. Everything else (routing engine, classifier, audit chain, UI, verify-chain) will be fully working and demoable end-to-end with a "Simulate call" fallback that injects the Sarah/$847 transcript so you can verify the V01 + 10.4 acceptance criterion before plugging in voice.

