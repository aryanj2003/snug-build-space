# Initial State & Voice Cleanup Bugfix Design

## Overview

Two bugs degrade the Aegis Voice Intake experience. First, the `EnforcementLedger` displays misleading pre-populated metrics (94% confidence, 4/4 validations, LOW risk band) when the app opens in idle state with no data. Second, the ElevenLabs voice stream continues playing after the complaint flow is finalized via the `finalize_intake` client tool because `conversation.endSession()` is never called. The fix removes the hardcoded confidence fallback, makes `ConfidenceGauge` stats derive from actual state, and ensures `endSession()` is called when finalizing a live voice session.

## Glossary

- **Bug_Condition (C)**: The union of two conditions — (1) the app is in idle/empty state and the gauge displays non-zero hardcoded values, or (2) `finalize_intake` is called during a live voice session without terminating the ElevenLabs stream.
- **Property (P)**: (1) The gauge displays 0%/zeroed stats when no data exists. (2) The voice session is terminated when the complaint is finalized.
- **Preservation**: Existing behavior that must remain unchanged — live-call dynamic updates, final-state display after finalize, simulation flow, status transitions, and End Call button behavior.
- **`EnforcementLedger`**: The component in `src/components/aegis/EnforcementLedger.tsx` that renders the extraction table and `ConfidenceGauge`.
- **`ConfidenceGauge`**: The sub-component that renders the circular confidence gauge and stat rows (Schema, Validations, Missing fields, Risk band).
- **`finalize()`**: The callback in `src/routes/index.tsx` that classifies the transcript, scores completeness, routes the case, and commits it.
- **`finalize_intake`**: The ElevenLabs client tool that the AI agent calls to end the intake flow; currently calls `finalize()` without ending the voice session.
- **`conversation.endSession()`**: The ElevenLabs SDK method that terminates the WebSocket voice stream.

## Bug Details

### Bug Condition

The bugs manifest in two independent scenarios:

**Bug A — Hardcoded Initial State**: When the app opens with `status="idle"`, `classification=null`, `draft={}`, and `completeness=null`, the `EnforcementLedger` displays 94% confidence (from the `?? 0.94` fallback), "4/4 passed" validations, "none" missing fields, and "LOW" risk band — all hardcoded in the `ConfidenceGauge` component.

**Bug B — Voice Continues After Finalize**: When the AI agent calls `finalize_intake` during a live voice session, the client tool invokes `finalize()` which sets `status="ended"` but never calls `conversation.endSession()`, so the ElevenLabs WebSocket stream continues transmitting audio.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { status: Status, classification: ClassifyResult | null, draft: CaseDraft, completeness: CompletenessResult | null, triggerSource: "finalize_intake" | "stopVoice" | "render" }
  OUTPUT: boolean

  // Bug A: Hardcoded initial state
  bugA := input.triggerSource == "render"
          AND input.classification == null
          AND input.draft == {}
          AND input.completeness == null

  // Bug B: Voice not terminated on finalize_intake
  bugB := input.triggerSource == "finalize_intake"
          AND input.status == "live"

  RETURN bugA OR bugB
END FUNCTION
```

### Examples

- **Bug A, Example 1**: App opens → `classification=null`, `draft={}` → confidence line evaluates `null ?? undefined ?? 0.94 = 0.94` → gauge shows 94%. Expected: 0%.
- **Bug A, Example 2**: App opens → `ConfidenceGauge` renders `<Stat label="Validations" value="4/4 passed" />` regardless of state → shows "4/4 passed". Expected: "0/0" or "—".
- **Bug A, Example 3**: App opens → `<Stat label="Risk band" value="LOW" />` is hardcoded → shows "LOW". Expected: "—" or "N/A".
- **Bug B, Example 1**: Agent calls `finalize_intake` during live call → `finalize()` runs, sets `status="ended"` → voice WebSocket stays open → user hears continued audio. Expected: `conversation.endSession()` called, audio stops.
- **Bug B, Example 2**: Agent calls `finalize_intake` when `status != "live"` (e.g., already ended) → no voice session to terminate → should be a no-op for endSession. Expected: finalize proceeds normally without error.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When a call is live (`status="live"`) and fields are being captured, the confidence gauge, validation counts, missing fields, and risk band MUST continue to update dynamically as data arrives.
- When the call has ended and finalize has completed, the final classification confidence, completeness score, routing result, and audit trail MUST display accurately.
- When `startVoice()` is called, the status transition `idle → connecting → live` and transcript/field capture MUST work normally.
- When `runSimulation()` is called, the demo steps, field capture, and finalization MUST execute exactly as before.
- When the user clicks "End Call" (`stopVoice()`), the existing flow of `conversation.endSession()` followed by `finalize()` MUST continue to work.
- Mouse clicks, button interactions, and all non-gauge UI elements MUST remain unchanged.

**Scope:**
All inputs where the bug condition does NOT hold should be completely unaffected. This includes:
- Any render where `classification` is non-null (real confidence data exists)
- Any render where `completeness` is non-null (real completeness data exists)
- The `stopVoice()` path (already calls `endSession()`)
- Any `finalize_intake` call when `status != "live"`

## Hypothesized Root Cause

Based on the code analysis, the root causes are:

1. **Hardcoded Confidence Fallback** (`EnforcementLedger.tsx`, line ~72): The expression `classification?.confidence ?? draft.classification_confidence ?? 0.94` uses `0.94` as a final fallback. When both `classification` and `draft.classification_confidence` are undefined (idle state), the gauge renders 94%.

2. **Static ConfidenceGauge Stats** (`EnforcementLedger.tsx`, `ConfidenceGauge` function): The `Stat` components render hardcoded strings:
   - `value="4/4 passed"` — should derive from actual validation count based on completeness and classification state.
   - `value="LOW"` — should derive from classification confidence or show a placeholder when no data exists.
   - The `missing` prop correctly drives the "Missing fields" stat, but the others ignore actual state.

3. **Missing `endSession()` in `finalize_intake`** (`src/routes/index.tsx`, `finalize_intake` client tool): The tool calls `void finalize()` but never calls `conversation.endSession()`. The `stopVoice` callback correctly calls `endSession()` first, but `finalize_intake` bypasses that path entirely.

4. **No Status Check in `finalize_intake`**: The client tool doesn't check whether the session is live before finalizing, and has no reference to the `conversation` object to call `endSession()`.

## Correctness Properties

Property 1: Bug Condition A — Initial State Shows Zeroed Metrics

_For any_ render of `EnforcementLedger` where `classification` is null, `draft` is empty (no `classification_confidence`), and `completeness` is null, the confidence gauge SHALL display 0% and all stat rows SHALL display placeholder/zero values (not hardcoded "4/4 passed", "LOW", or 94%).

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition B — Voice Session Terminated on Finalize Intake

_For any_ invocation of the `finalize_intake` client tool when the voice session status is "live", the system SHALL call `conversation.endSession()` to terminate the ElevenLabs voice stream before or during finalization.

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation — Dynamic Gauge Updates During Live Call

_For any_ render of `EnforcementLedger` where `classification` is non-null or `completeness` is non-null (i.e., real data exists), the confidence gauge and stat rows SHALL display values derived from the actual `classification`, `completeness`, and `draft` state, matching the behavior of the original code for non-idle states.

**Validates: Requirements 3.1, 3.2**

Property 4: Preservation — Existing Finalization Paths Unchanged

_For any_ invocation of `stopVoice()` or `finalize()` through paths other than `finalize_intake`, the system SHALL produce the same behavior as the original code, preserving status transitions, classification, completeness scoring, routing, and case commit.

**Validates: Requirements 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/components/aegis/EnforcementLedger.tsx`

**Function**: `EnforcementLedger` and `ConfidenceGauge`

**Specific Changes**:

1. **Remove 0.94 fallback**: Change the confidence computation from `classification?.confidence ?? draft.classification_confidence ?? 0.94` to `classification?.confidence ?? draft.classification_confidence ?? 0`. When no classification data exists, confidence should be 0.

2. **Make ConfidenceGauge accept dynamic props**: Extend the `ConfidenceGauge` props to accept `classification`, `completeness`, and `draft` (or derived values) so stats can be computed from actual state.

3. **Derive Validations stat dynamically**: Compute the validation count from actual state. For example, count how many of the 4 extraction rows have values, or derive from `completeness` score. When no data exists, show "—" or "0/0".

4. **Derive Risk Band dynamically**: Compute risk band from `classification?.confidence` — e.g., confidence ≥ 0.8 → "LOW", 0.5–0.8 → "MEDIUM", < 0.5 → "HIGH", null/undefined → "—". When no classification exists, show "—".

5. **Keep Schema stat as-is**: "ISO-20022" is a constant protocol label, not a dynamic value — it can remain hardcoded.

**File**: `src/routes/index.tsx`

**Function**: `finalize_intake` client tool and `finalize` callback

**Specific Changes**:

1. **Call `endSession()` in `finalize_intake`**: Before calling `finalize()`, check if the session is live and call `conversation.endSession()` to terminate the voice stream. Since `finalize_intake` is defined inside the `useConversation` `clientTools` object, it doesn't have direct access to the `conversation` return value. The fix should use a ref or restructure so `endSession` can be called.

2. **Alternative approach — call `endSession()` inside `finalize()`**: Add a mechanism (e.g., a ref to the conversation's `endSession` method, or a status check) so that `finalize()` itself can terminate the voice session when `status === "live"`. This keeps the fix centralized. The `finalize` callback can accept or reference the conversation object via a ref.

3. **Guard against double `endSession()`**: Since `stopVoice()` already calls `endSession()` before `finalize()`, ensure calling `endSession()` twice (once in `finalize_intake` and once if `stopVoice` is also triggered) doesn't cause errors. The ElevenLabs SDK should handle this gracefully, but add a guard if needed.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write component tests for `ConfidenceGauge` rendering with empty/null props, and unit tests for the `finalize_intake` client tool verifying whether `endSession()` is called. Run these on the UNFIXED code to observe failures.

**Test Cases**:
1. **Idle State Confidence Test**: Render `EnforcementLedger` with `classification=null`, `draft={}`, `completeness=null` → assert gauge shows 0% (will fail on unfixed code, showing 94%).
2. **Idle State Validations Test**: Render `ConfidenceGauge` with no data → assert "Validations" stat is not "4/4 passed" (will fail on unfixed code).
3. **Idle State Risk Band Test**: Render `ConfidenceGauge` with no data → assert "Risk band" is not "LOW" (will fail on unfixed code).
4. **Finalize Intake endSession Test**: Mock `conversation.endSession`, invoke `finalize_intake` client tool → assert `endSession` was called (will fail on unfixed code).

**Expected Counterexamples**:
- Gauge renders "94%" when no classification data exists
- Stats render hardcoded "4/4 passed" and "LOW" regardless of state
- `finalize_intake` never calls `conversation.endSession()`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.triggerSource == "render" THEN
    rendered := render(EnforcementLedger, { classification: null, draft: {}, completeness: null })
    ASSERT rendered.confidenceGauge.percentage == 0
    ASSERT rendered.confidenceGauge.validations != "4/4 passed"
    ASSERT rendered.confidenceGauge.riskBand IN ["—", "N/A"]
  ELSE IF input.triggerSource == "finalize_intake" AND input.status == "live" THEN
    result := finalize_intake()
    ASSERT conversation.endSession.wasCalled == true
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  IF input.triggerSource == "render" THEN
    // When real data exists, gauge should show actual values
    ASSERT render_original(input) == render_fixed(input)
  ELSE IF input.triggerSource == "stopVoice" THEN
    ASSERT stopVoice_original(input) == stopVoice_fixed(input)
  ELSE IF input.triggerSource == "finalize_intake" AND input.status != "live" THEN
    ASSERT finalize_original(input) == finalize_fixed(input)
  END IF
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random `CaseDraft` / `ClassifyResult` / `CompletenessResult` combinations to verify the gauge renders correctly across the full input domain
- It catches edge cases like partial drafts, boundary confidence values, and unusual completeness scores
- It provides strong guarantees that the gauge behavior is unchanged for all non-idle states

**Test Plan**: Observe behavior on UNFIXED code first for non-idle renders and non-finalize_intake paths, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Live Call Gauge Preservation**: Generate random `ClassifyResult` (confidence 0–1) and `CompletenessResult`, render `EnforcementLedger`, verify gauge shows actual confidence percentage and derived stats.
2. **StopVoice Flow Preservation**: Mock conversation, call `stopVoice()`, verify `endSession()` is called followed by `finalize()` — same as original behavior.
3. **Simulation Flow Preservation**: Run `runSimulation()`, verify fields are captured and finalize is called with correct data.
4. **Non-Live Finalize Intake Preservation**: Call `finalize_intake` when `status != "live"`, verify finalize proceeds without calling `endSession()`.

### Unit Tests

- Test `ConfidenceGauge` renders 0% with `value=0` and `missing=0`
- Test `ConfidenceGauge` renders correct percentage for various confidence values (0, 0.5, 0.73, 1.0)
- Test dynamic Validations stat shows correct count based on completeness data
- Test dynamic Risk Band shows correct band based on confidence thresholds
- Test `finalize_intake` calls `endSession()` when status is "live"
- Test `finalize_intake` does NOT call `endSession()` when status is not "live"

### Property-Based Tests

- Generate random `ClassifyResult` with confidence in [0, 1] and random `CompletenessResult`, render `ConfidenceGauge`, verify displayed percentage equals `Math.round(confidence * 100)` and stats derive from actual data
- Generate random `CaseDraft` states with varying field completeness, verify validation count matches actual filled/total field ratio
- Generate random confidence values, verify risk band mapping is consistent (≥0.8 → LOW, 0.5–0.8 → MEDIUM, <0.5 → HIGH, null → "—")

### Integration Tests

- Test full idle → live → ended flow: verify gauge starts at 0%, updates during call, shows final values after finalize
- Test `finalize_intake` during live voice session: verify voice stream terminates and case finalizes correctly
- Test "End Call" button: verify `endSession()` + `finalize()` sequence works as before
- Test simulation flow end-to-end: verify gauge updates and final state are correct
