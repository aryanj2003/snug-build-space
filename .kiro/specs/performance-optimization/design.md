# Performance Optimization Bugfix Design

## Overview

The Aegis Voice Intake app suffers from seven interrelated performance defects that cause UI lag, audio drops, and main-thread contention during live voice calls. The root causes span unstable React references destabilizing the ElevenLabs WebSocket, missing memoization boundaries allowing cascading re-renders, unthrottled synchronous work (completeness scoring, regex compilation, JSON rebuilding), an uncapped 60fps canvas animation loop, and inefficient transcript array operations with forced layout reflows. The fix strategy applies targeted React memoization, debouncing/throttling, and efficient DOM operations while preserving all existing functional behavior.

## Glossary

- **Bug_Condition (C)**: Any render cycle or state update in `IntakePage` that triggers unnecessary recomputation, re-rendering, or reference instability — specifically: inline `clientTools` object creation, unmemoized child components, unthrottled `scoreCompleteness()`, per-render regex compilation, 60fps canvas loop, per-update ISO-20022 rebuild, and transcript array spread with forced reflow
- **Property (P)**: The desired behavior where each of these operations is stabilized, memoized, debounced, or throttled so the main thread remains responsive during live voice calls
- **Preservation**: All existing functional behavior — field capture, voice connection, transcript display, trace highlighting, ISO-20022 output, audit chain, routing, and simulation — must remain identical
- **`IntakePage`**: The main component in `src/routes/index.tsx` that holds ~13 state variables and renders the entire intake console
- **`clientTools`**: The object passed to `useConversation()` containing `capture_field`, `mark_dispute_reason`, and `finalize_intake` handlers for the ElevenLabs voice agent
- **`scoreCompleteness()`**: Pure function in `src/lib/aegis/completeness.ts` that scores draft completeness against required/conditional fields
- **`tracePatternsForDraft()`**: Function in `src/lib/aegis/highlight.tsx` that compiles `RegExp` objects from draft field values for transcript highlighting
- **`buildIso20022()` / `syntaxHighlightJson()`**: Functions in `src/lib/aegis/iso20022.ts` that build the bank-compliant JSON and apply regex-based syntax coloring

## Bug Details

### Bug Condition

The bug manifests when the `IntakePage` component re-renders due to any of its ~13 state variables changing. Each render triggers a cascade of unnecessary work: a new `clientTools` object is created inline (destabilizing the ElevenLabs WebSocket), all child components re-render (no `React.memo` boundaries), `scoreCompleteness()` runs synchronously on every draft change, `tracePatternsForDraft()` recompiles regex patterns, the Waveform canvas runs at uncapped 60fps, `buildIso20022()` + `syntaxHighlightJson()` rebuild on every update, and transcript appends use array spread with forced layout reflow.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { trigger: StateChange, component: ReactComponent }
  OUTPUT: boolean

  // Defect 1: Unstable clientTools
  IF input.trigger causes IntakePage re-render
     AND clientTools object is recreated inline (not memoized)
  RETURN true

  // Defect 2: Cascading re-renders
  IF input.trigger changes ANY state variable in IntakePage
     AND child component (CallStream | EnforcementLedger | SystemOutput | Waveform) re-renders
     AND child component's props have NOT meaningfully changed
  RETURN true

  // Defect 3: Unthrottled completeness scoring
  IF input.trigger is a draft change during status === "live"
     AND scoreCompleteness() is called synchronously without debounce
  RETURN true

  // Defect 4: Regex recompilation
  IF input.trigger causes CallStream re-render
     AND tracePatternsForDraft() recompiles RegExp objects
     AND underlying draft field values have NOT changed
  RETURN true

  // Defect 5: 60fps canvas animation
  IF Waveform.active === true
     AND requestAnimationFrame loop runs at native refresh rate (60fps+)
     AND per-bar gradient + shadow effects are created every frame
  RETURN true

  // Defect 6: ISO-20022 rebuild
  IF input.trigger changes draft OR classification
     AND buildIso20022() + syntaxHighlightJson() run on every update
     AND the inputs to buildIso20022() have NOT changed since last computation
  RETURN true

  // Defect 7: Transcript array spread + forced reflow
  IF input.trigger is a new transcript message
     AND setTranscript uses spread operator creating new array
     AND useEffect scrolls via el.scrollTop = el.scrollHeight (forced layout reflow)
  RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Defect 1**: User is on a live call. `setCompleteness()` fires, causing `IntakePage` to re-render. A new `clientTools` object is created inline, `useConversation()` sees a new reference, and the ElevenLabs WebSocket reconnects or drops audio.
- **Defect 2**: A single field capture updates `draft`. All four child components (`CallStream`, `EnforcementLedger`, `SystemOutput`, `Waveform`) re-render even though `Waveform` only depends on `status` and `EnforcementLedger` hasn't received new props.
- **Defect 3**: During a live call, the agent captures 5 fields in rapid succession. `scoreCompleteness()` runs 5 times synchronously, each blocking the main thread.
- **Defect 4**: `CallStream` re-renders because `lines` changed (new transcript message). `tracePatternsForDraft(draft)` recompiles all regex patterns even though `draft` hasn't changed.
- **Defect 5**: During a live call, the Waveform canvas draws 64 bars at 60fps, creating 64 `createLinearGradient()` calls and setting `shadowBlur = 6` per frame, competing with the audio context.
- **Defect 6**: Each field capture triggers `draft` change → `useMemo` in `SystemOutput` recomputes `buildIso20022()` and `syntaxHighlightJson()` even for rapid successive updates.
- **Defect 7**: During a 2-minute call with 40+ transcript messages, each `appendTranscript` creates a new array via `[...prev, line]`, and the scroll `useEffect` triggers `el.scrollTop = el.scrollHeight` causing a forced synchronous layout reflow.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Field capture via `capture_field`, `mark_dispute_reason`, and `finalize_intake` client tools must continue to coerce and validate values identically
- The "Validate & Route Dispute" flow (classify → score → route → commit → audit chain) must produce identical results
- Hovering over a field in `EnforcementLedger` must continue to highlight matching terms in the `CallStream` transcript via the trace context
- The Waveform must continue to display a real-time audio visualization from microphone input (at a visually acceptable frame rate)
- The "Simulate" button must continue to play back the `SARAH_DEMO` script with the same timing, field captures, and finalization
- The ISO-20022 JSON panel must continue to display a syntax-highlighted, bank-compliant JSON representation of the current draft state
- The transcript must continue to display all messages in chronological order with correct timestamps after the call ends

**Scope:**
All functional behavior — data flow, validation logic, Supabase operations, routing decisions, audit chain integrity, and visual output — must be completely unaffected by these performance optimizations. Only the timing and frequency of intermediate computations change.

## Hypothesized Root Cause

Based on the code analysis, the root causes are:

1. **Unstable `clientTools` reference (Defect 1)**: In `src/routes/index.tsx`, the `clientTools` object is defined inline inside the `useConversation()` call (lines ~220-250). Every render creates a new object reference. The `useConversation` hook from `@elevenlabs/react` likely uses this reference in a dependency array or effect, causing the WebSocket connection to destabilize.

2. **Missing `React.memo` boundaries (Defect 2)**: None of the child components (`CallStream`, `EnforcementLedger`, `SystemOutput`, `Waveform`) are wrapped with `React.memo`. Since `IntakePage` holds ~13 state variables, any state change re-renders all children regardless of whether their props changed.

3. **Synchronous unthrottled scoring (Defect 3)**: The `useEffect` at the bottom of `IntakePage` calls `scoreCompleteness(draft)` on every `draft` change when `status === "live"`. There is no debounce, so rapid field captures cause repeated synchronous scoring.

4. **Per-render regex compilation (Defect 4)**: `tracePatternsForDraft()` in `src/lib/aegis/highlight.tsx` constructs new `RegExp` objects every call. While `CallStream` uses `useMemo(() => tracePatternsForDraft(draft), [draft])`, the `draft` object reference changes on every field capture (since `setDraft` creates a new object via spread), invalidating the memo even when the relevant fields haven't changed.

5. **Uncapped 60fps canvas loop (Defect 5)**: `Waveform.tsx` uses `requestAnimationFrame(draw)` without any frame-skipping logic. Each frame creates 64 `createLinearGradient()` calls and sets `shadowBlur = 6` per bar, which are expensive canvas operations.

6. **Per-update JSON rebuild (Defect 6)**: `SystemOutput` already uses `useMemo` for `buildIso20022` and `syntaxHighlightJson`, but the `draft` object reference changes on every field capture, invalidating both memos. The `syntaxHighlightJson` regex replacement is particularly expensive on large JSON strings.

7. **Array spread + forced reflow (Defect 7)**: `appendTranscript` uses `setTranscript((prev) => [...prev, line])` which copies the entire array on every message. The scroll `useEffect` sets `el.scrollTop = el.scrollHeight` which forces the browser to compute layout synchronously.

## Correctness Properties

Property 1: Bug Condition - Stable References and Throttled Computation

_For any_ render cycle or state update in `IntakePage` where the bug condition holds (unnecessary recomputation, re-rendering, or reference instability occurs), the fixed code SHALL eliminate the unnecessary work: `clientTools` SHALL be a stable memoized reference, child components SHALL only re-render when their specific props change, `scoreCompleteness()` SHALL be debounced, `tracePatternsForDraft()` output SHALL be memoized by field values, the canvas loop SHALL be throttled to ≤30fps, ISO-20022 rebuild SHALL not run more frequently than needed, and transcript appends SHALL not cause forced layout reflows.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - Functional Behavior Unchanged

_For any_ user interaction that does NOT involve the performance-sensitive render paths (field capture validation, routing decisions, audit chain computation, simulation playback, trace highlighting), the fixed code SHALL produce exactly the same results as the original code, preserving all data flow, validation logic, Supabase operations, visual output, and user-facing behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/routes/index.tsx`

**Function**: `IntakePage`

**Specific Changes**:

1. **Memoize `clientTools` (Defect 1)**: Extract the `clientTools` object from the `useConversation()` call and wrap it in `useMemo` (with stable callback dependencies via `useCallback` for `captureField` and `finalize`). This ensures `useConversation()` receives a stable reference across renders.

2. **Debounce completeness scoring (Defect 3)**: Replace the direct `useEffect` that calls `scoreCompleteness(draft)` on every draft change with a debounced version (e.g., 300ms delay using `setTimeout`/`clearTimeout` in the effect cleanup). This prevents rapid successive scoring during field captures.

3. **Stabilize `clientTools` reference passed to `useConversation` (Defect 1)**: Use `useMemo` with dependencies on the stable `captureField` and `finalize` callbacks (which are already wrapped in `useCallback`). The `clientTools` object should only be recreated when these callbacks change.

---

**File**: `src/components/aegis/CallStream.tsx`

**Specific Changes**:

4. **Wrap with `React.memo` (Defect 2)**: Export the component wrapped in `React.memo` so it only re-renders when `status`, `lines`, or `draft` actually change by reference.

5. **Memoize trace patterns by field values (Defect 4)**: Instead of memoizing `tracePatternsForDraft(draft)` with `[draft]` as dependency (which changes on every field capture), create a stable key from the specific draft fields used by `tracePatternsForDraft` (`amount_cents`, `merchant`, `customer_name`, `last4`, `transaction_date`, `dispute_reason`) and use that as the memo dependency.

6. **Use `requestAnimationFrame` with `scrollIntoView` for scroll (Defect 7)**: Replace the synchronous `el.scrollTop = el.scrollHeight` with a `requestAnimationFrame` callback to avoid forced layout reflow.

---

**File**: `src/components/aegis/EnforcementLedger.tsx`

**Specific Changes**:

7. **Wrap with `React.memo` (Defect 2)**: Export the component wrapped in `React.memo`.

---

**File**: `src/components/aegis/SystemOutput.tsx`

**Specific Changes**:

8. **Wrap with `React.memo` (Defect 2)**: Export the component wrapped in `React.memo`.

9. **Stabilize `useMemo` dependencies (Defect 6)**: The existing `useMemo` for `buildIso20022` and `syntaxHighlightJson` already has correct dependencies `[draft, classification, routing, caseId]`. Since `draft` is a new object on every field capture, create a serialized key from the draft fields that actually affect the ISO-20022 output, and use that as the memo dependency instead.

---

**File**: `src/components/aegis/Waveform.tsx`

**Specific Changes**:

10. **Wrap with `React.memo` (Defect 2)**: Export the component wrapped in `React.memo`.

11. **Throttle canvas to ~30fps (Defect 5)**: Add frame-skipping logic to the `draw()` function using a timestamp check. Only draw when ≥33ms have elapsed since the last frame. This halves the GPU/CPU load while maintaining smooth visual appearance.

12. **Cache gradient and reduce shadow operations (Defect 5)**: Create the gradient once outside the bar loop (since all bars use the same gradient colors), and reduce or eliminate per-bar `shadowBlur` settings.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the performance defects on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the performance defects BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that measure render counts, reference stability, and computation frequency. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **clientTools Stability Test**: Assert that the `clientTools` object passed to `useConversation` maintains referential equality across re-renders when only unrelated state changes (will fail on unfixed code — new object created each render)
2. **Child Re-render Test**: Render `IntakePage`, change a state variable that doesn't affect `Waveform` props, and assert `Waveform` does not re-render (will fail on unfixed code — no `React.memo`)
3. **Completeness Scoring Frequency Test**: Trigger 5 rapid draft changes and assert `scoreCompleteness` is called fewer than 5 times (will fail on unfixed code — called on every change)
4. **Regex Recompilation Test**: Call `tracePatternsForDraft` with the same draft values and assert the returned patterns are referentially equal (will fail on unfixed code — new RegExp objects each call)

**Expected Counterexamples**:
- `clientTools` reference changes on every render cycle
- Child components re-render even when their props haven't changed
- `scoreCompleteness` is called once per draft change with no debounce
- New `RegExp` objects are created on every `tracePatternsForDraft` call

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedComponent(input)
  ASSERT expectedBehavior(result)
    // clientTools reference is stable across renders
    // child components skip re-render when props unchanged
    // scoreCompleteness is debounced (≤1 call per 300ms window)
    // tracePatternsForDraft returns memoized result for same field values
    // Waveform draws at ≤30fps
    // ISO-20022 rebuild is memoized by field values
    // transcript scroll uses rAF instead of forced reflow
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
    // scoreCompleteness returns identical results for same draft
    // tracePatternsForDraft returns identical patterns for same draft
    // buildIso20022 returns identical JSON for same inputs
    // syntaxHighlightJson returns identical HTML for same JSON
    // field coercion and validation produce identical results
    // transcript ordering and content are identical
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random `CaseDraft` configurations to verify `scoreCompleteness` and `tracePatternsForDraft` produce identical results before and after memoization
- It catches edge cases in field value serialization that manual tests might miss
- It provides strong guarantees that the memoization keys correctly capture all relevant input variations

**Test Plan**: Observe behavior on UNFIXED code first for pure functions (`scoreCompleteness`, `tracePatternsForDraft`, `buildIso20022`, `syntaxHighlightJson`), then write property-based tests verifying the fixed versions produce identical output.

**Test Cases**:
1. **Completeness Scoring Preservation**: For any random `CaseDraft`, verify `scoreCompleteness(draft)` returns the same `{ score, missing_fields }` before and after the debounce wrapper
2. **Trace Pattern Preservation**: For any random `CaseDraft`, verify `tracePatternsForDraft(draft)` produces patterns that match the same substrings in test text before and after memoization
3. **ISO-20022 Preservation**: For any random `CaseDraft` + `ClassifyResult` + `RouteResult`, verify `buildIso20022()` returns identical JSON before and after the memo key change
4. **Syntax Highlight Preservation**: For any random JSON string, verify `syntaxHighlightJson()` returns identical HTML

### Unit Tests

- Test that `React.memo` wrapped components skip re-render when props are shallowly equal
- Test that debounced `scoreCompleteness` eventually produces the correct result after the debounce window
- Test that the Waveform frame-skipping logic respects the ~33ms threshold
- Test that transcript scroll uses `requestAnimationFrame` instead of synchronous assignment

### Property-Based Tests

- Generate random `CaseDraft` objects and verify `scoreCompleteness` output is identical to the original implementation
- Generate random `CaseDraft` objects and verify `tracePatternsForDraft` produces functionally equivalent regex patterns
- Generate random draft/classification/routing combinations and verify `buildIso20022` output is identical
- Generate random JSON strings and verify `syntaxHighlightJson` output is identical

### Integration Tests

- Test a full simulated call flow (start → field captures → finalize) and verify all outputs match expected values
- Test that the ElevenLabs `useConversation` hook receives a stable `clientTools` reference across multiple renders
- Test that the Waveform continues to render visual output at the throttled frame rate
- Test that transcript messages appear in correct order with correct highlighting after the performance fixes
