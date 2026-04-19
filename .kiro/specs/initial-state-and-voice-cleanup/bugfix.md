# Bugfix Requirements Document

## Introduction

The Aegis Voice Intake app has two bugs that degrade the user experience. First, when the app opens in its idle state, the ISO-20022 schema panel displays pre-populated data (94% confidence, 4/4 validations passed, LOW risk band) instead of zeroed/empty values. These metrics should start at zero and update in real-time as the call progresses. Second, the ElevenLabs voice/call stream continues playing audio even after the complaint flow is closed — either by the user clicking "End Call" or by the agent invoking the `finalize_intake` client tool. The voice session should be explicitly terminated whenever the complaint is finalized.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app opens with status="idle" and draft is empty ({}) THEN the system displays a confidence gauge showing 94% because `EnforcementLedger.tsx` computes confidence as `classification?.confidence ?? draft.classification_confidence ?? 0.94`, falling through to the hardcoded 0.94 default.

1.2 WHEN the app opens with status="idle" and no fields have been captured THEN the system displays "4/4 passed" for validations, "none" for missing fields, and "LOW" for risk band because the `ConfidenceGauge` component renders these as hardcoded static strings regardless of actual state.

1.3 WHEN the agent calls the `finalize_intake` client tool during a live voice session THEN the system calls `finalize()` which sets status="ended" but never calls `conversation.endSession()`, so the ElevenLabs voice stream continues transmitting audio after the complaint flow has ended.

1.4 WHEN the user clicks "End Call" and `stopVoice()` is invoked THEN the system calls `conversation.endSession()` followed by `finalize()`, but the `onDisconnect` callback only updates status without performing resource cleanup, and there is no guarantee the voice stream is fully terminated before finalize proceeds.

### Expected Behavior (Correct)

2.1 WHEN the app opens with status="idle" and draft is empty ({}) THEN the system SHALL display 0% confidence in the gauge, reflecting that no classification data exists yet.

2.2 WHEN the app opens with status="idle" and no fields have been captured THEN the system SHALL display "0/0" (or equivalent zero state) for validations, show the actual count of missing fields (or a dash/empty indicator), and show no risk band (e.g., "—" or "N/A") instead of "LOW".

2.3 WHEN the agent calls the `finalize_intake` client tool during a live voice session THEN the system SHALL call `conversation.endSession()` to terminate the ElevenLabs voice stream before or as part of the finalize flow, ensuring no audio continues after the complaint is closed.

2.4 WHEN the user clicks "End Call" and `stopVoice()` is invoked THEN the system SHALL ensure the voice stream is fully terminated and no audio continues after the call ends, with proper cleanup of the conversation session.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a call is live (status="live") and fields are being captured in real-time THEN the system SHALL CONTINUE TO update the confidence gauge, validation counts, missing fields, and risk band dynamically as data arrives.

3.2 WHEN the call has ended and finalize has completed successfully THEN the system SHALL CONTINUE TO display the final classification confidence, completeness score, routing result, and audit trail accurately.

3.3 WHEN `startVoice()` is called and the voice session connects successfully THEN the system SHALL CONTINUE TO transition status from "idle" → "connecting" → "live" and begin capturing transcript and field data normally.

3.4 WHEN a simulated call is run via `runSimulation()` THEN the system SHALL CONTINUE TO play through the demo steps, capture fields, and finalize the case exactly as before.

3.5 WHEN the user clicks "End Call" during a live voice session THEN the system SHALL CONTINUE TO trigger finalization (classification, completeness scoring, routing, and case commit) after stopping the voice.
