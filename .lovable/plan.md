

## Aegis Voice — Enterprise Fintech Dashboard Redesign

A complete visual + structural redesign of the existing intake page into a high-end "Industrial" 3-column console, with a Legacy Mode toggle that swaps the entire shell into a Windows 95 aesthetic.

### Approach

Keep all existing backend logic (ElevenLabs voice, capture handlers, classify/route/commit pipeline, audit trail) **untouched**. Only the presentation layer changes. The current data flow already produces everything we need:
- `transcript` lines → Live Call Stream
- `draft` + `classification` → Extraction Ledger
- `routing` + final draft → JSON output + Routing Engine
- `caseId` + `finalize` → "VALIDATE & ROUTE DISPUTE" button

### Visual system (`src/styles.css`)

Switch dark theme to Slate-950 / Cyan-400 / Emerald-500 / Amber-500. Add Inter (UI) + JetBrains Mono (data/code) via `@import` from Google Fonts in `index.html`. Add `font-mono` utility wired to JetBrains Mono. Keep existing semantic tokens — only retune values so all components inherit the new look.

New keyframes: `pulse-dot` (header status), `caret-blink` (transcript caret), `scan-line` (subtle grid overlay).

### Component structure

```text
src/routes/index.tsx          (orchestrator — keep voice/finalize logic, swap layout)
src/components/aegis/
  Header.tsx                  NEW — slim bar, pulsing cyan dot, Legacy toggle
  Waveform.tsx                NEW — canvas-based cyan waveform from mic analyser
  CallStream.tsx              NEW — wraps Waveform + scrolling mono transcript w/ keyword highlight
  EnforcementLedger.tsx       NEW — table (Field/Value/Source/Status) + radial confidence gauge
  SystemOutput.tsx            NEW — ISO-20022 JSON block + routing diagram + VALIDATE button
  LegacyShell.tsx             NEW — Win95 reskin reading the same state
  TraceContext.tsx            NEW — React context for hover-to-highlight (ledger ↔ transcript)
```

Existing `CallControl`, `LiveCaseCard`, `AuditTrail`, `Transcript` components stay in the repo (used as fallbacks / inside the new components where useful) but the index route stops importing the old layout cards.

### Key interactions

1. **Trace Effect** — `TraceContext` stores `hoveredField`. Ledger rows set it on `onMouseEnter`. Each transcript line checks if its text contains the captured value for that field and applies a cyan highlight + ring. Field→keyword map: `amount_cents`→formatted currency, `merchant`→merchant string, `dispute_reason`→keywords like "wasn't me", "fraud", "didn't authorize".

2. **Static keyword highlight** — Always highlight `$xxx`, "gas station", "wasn't me" in cyan via a small `highlightKeywords(text)` util that returns React nodes.

3. **Waveform** — When `status==="live"` and we have mic access, tap `MediaStream` from `getUserMedia` (already requested in `startVoice`) into a `Web Audio API` `AnalyserNode` and draw bars on canvas at 60fps. Pre-call: idle sine shimmer.

4. **Confidence gauge** — SVG circle, `stroke-dashoffset` animated via framer-motion spring, shows `classification.confidence * 100` (or pre-classify draft confidence).

5. **JSON block** — Build ISO-20022 `CustomerPaymentReversalRequest`-shaped object live from `draft` + `classification` + `routing`. Render with a tiny inline syntax highlighter (regex-based: keys cyan, strings emerald, numbers amber). framer-motion `AnimatePresence` per line as fields populate.

6. **Routing diagram** — Three pill nodes (`INTAKE → AEGIS → PEGA`) connected by animated cyan dashes. Active node pulses based on pipeline stage (`status`/`caseId`/`routing`).

7. **VALIDATE & ROUTE button** — Calls existing `stopVoice()` (which finalizes). Glowing cyan with framer-motion tap/hover springs. Disabled until completeness ≥ threshold.

8. **Legacy Mode toggle** — Boolean state in index route. When `true`, render `<LegacyShell />` instead of the new console — same data, but:
   - Beige `#c0c0c0` background, `MS Sans Serif` font (system fallback `"Tahoma"`), 3D beveled borders via `border-style: outset/inset`
   - Title bars in navy with white text
   - Red `[MISCLASSIFIED]` badges on the ledger, ~half the fields shown as `<MISSING>`
   - Crappy non-animated "OK" button instead of the glowing CTA
   - This sells the "before/after" demo narrative

### Animations (framer-motion)

- Ledger rows: `initial={{opacity:0, x:-8}} animate={{opacity:1, x:0}}` spring on capture
- Status checkmarks: `scale` spring 0→1 with stiffness 300
- JSON lines: stagger fade-in as keys arrive
- Mode swap: `AnimatePresence` crossfade between Aegis/Legacy shells
- Header pulse dot: CSS keyframe (lighter than framer for a 1Hz tick)

### Dependencies

- `framer-motion` — add via dependency manager
- Fonts: Inter + JetBrains Mono from Google Fonts (`<link>` in `__root.tsx` head)
- All other deps already present (lucide-react, existing ElevenLabs SDK, etc.)

### Files touched

**New:** `Header.tsx`, `Waveform.tsx`, `CallStream.tsx`, `EnforcementLedger.tsx`, `SystemOutput.tsx`, `LegacyShell.tsx`, `TraceContext.tsx`, `src/lib/aegis/iso20022.ts` (JSON builder), `src/lib/aegis/highlight.tsx` (keyword util)

**Modified:** `src/styles.css` (palette + fonts + keyframes), `src/routes/__root.tsx` (font links), `src/routes/index.tsx` (swap layout, wire TraceContext + Legacy toggle, expose mic stream to Waveform), `package.json` (framer-motion)

**Untouched:** all `src/lib/aegis/*` logic files, `src/server/*`, Supabase schema, ElevenLabs integration, audit trail.

### Out of scope

- No backend/schema changes
- ElevenLabs workflow consistency (already handled in last turn)
- AuditTrail component stays as-is below the 3-column console (still useful for the demo)

