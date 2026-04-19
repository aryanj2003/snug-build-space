# Bugfix Requirements Document

## Introduction

The Aegis Voice Intake app suffers from multiple performance bottlenecks that cause UI lag, voice agent audio drops, and general sluggishness when running locally. The root cause is a combination of unstable React hook references causing the ElevenLabs voice connection to destabilize, cascading re-renders across the entire component tree on every state change, and expensive synchronous work (regex compilation, completeness scoring, canvas animation, JSON building) competing with the audio context on the main thread.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `IntakePage` renders THEN the system creates a new `clientTools` object inline on every render, causing `useConversation()` to receive an unstable reference that destabilizes the ElevenLabs WebSocket voice connection

1.2 WHEN any single state variable among the ~13 state variables in `IntakePage` changes THEN the system re-renders the entire component tree including `CallStream`, `EnforcementLedger`, `SystemOutput`, and `Waveform` because no child components use `React.memo`

1.3 WHEN the draft changes during a live call THEN the system synchronously runs `scoreCompleteness()` on every draft update without debouncing, blocking the main thread

1.4 WHEN `CallStream` renders with an updated draft THEN the system recompiles regex patterns via `tracePatternsForDraft()` by constructing new `RegExp` objects on every render cycle

1.5 WHEN the Waveform component is active during a live call THEN the system runs a `requestAnimationFrame` loop at 60fps drawing canvas bars with per-bar gradient creation and shadow effects, competing with the audio context for main thread time

1.6 WHEN the draft or classification changes THEN the system rebuilds the full ISO-20022 JSON object and runs `syntaxHighlightJson()` regex replacement on every update without throttling

1.7 WHEN a new transcript message arrives THEN the system creates a new array via spread operator (`[...prev, line]`), and the scroll-to-bottom `useEffect` triggers a forced layout reflow on every message

### Expected Behavior (Correct)

2.1 WHEN `IntakePage` renders THEN the system SHALL pass a stable, memoized `clientTools` reference to `useConversation()` so the ElevenLabs voice connection is not destabilized by re-renders

2.2 WHEN a single state variable in `IntakePage` changes THEN the system SHALL only re-render the child components that depend on the changed state, by wrapping `CallStream`, `EnforcementLedger`, `SystemOutput`, and `Waveform` with `React.memo`

2.3 WHEN the draft changes during a live call THEN the system SHALL debounce completeness scoring so it does not run synchronously on every keystroke or field capture event

2.4 WHEN `CallStream` renders with an updated draft THEN the system SHALL reuse previously compiled regex patterns when the underlying draft values have not changed, by memoizing `tracePatternsForDraft()` output

2.5 WHEN the Waveform component is active during a live call THEN the system SHALL throttle the canvas draw loop to a lower frame rate (e.g., 30fps or lower) to reduce main thread contention with the audio context

2.6 WHEN the draft or classification changes THEN the system SHALL throttle or debounce the ISO-20022 JSON rebuild and syntax highlighting so it does not run on every single state update

2.7 WHEN a new transcript message arrives THEN the system SHALL append messages efficiently and avoid forced synchronous layout reflows from scroll-to-bottom behavior

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a live voice call is in progress THEN the system SHALL CONTINUE TO capture fields from the ElevenLabs agent via `capture_field`, `mark_dispute_reason`, and `finalize_intake` client tools with the same coercion and validation logic

3.2 WHEN the user clicks "Validate & Route Dispute" THEN the system SHALL CONTINUE TO classify the transcript, score completeness, route the case, commit to Supabase, and build the audit chain identically

3.3 WHEN the user hovers over a field in the EnforcementLedger THEN the system SHALL CONTINUE TO highlight matching terms in the CallStream transcript via the trace context

3.4 WHEN the Waveform component is active THEN the system SHALL CONTINUE TO display a real-time audio visualization from the microphone input

3.5 WHEN the user runs a simulation via the "Simulate" button THEN the system SHALL CONTINUE TO play back the SARAH_DEMO script with the same timing, field captures, and finalization behavior

3.6 WHEN the ISO-20022 JSON panel is visible THEN the system SHALL CONTINUE TO display a syntax-highlighted, bank-compliant JSON representation of the current draft state

3.7 WHEN the call ends or is finalized THEN the system SHALL CONTINUE TO display the complete transcript with all messages in chronological order with correct timestamps
