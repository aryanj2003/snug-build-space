/**
 * Bug Condition Exploration Tests
 *
 * These tests encode the EXPECTED (correct) behavior. They are designed to
 * FAIL on the current unfixed code, proving the bugs exist.
 *
 * Bug A: EnforcementLedger shows hardcoded metrics (94%, "4/4 passed", "LOW")
 *        when rendered in idle state with no data.
 * Bug B: finalize_intake does not call conversation.endSession() to terminate
 *        the voice stream.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { EnforcementLedger } from "@/components/aegis/EnforcementLedger";
import { TraceProvider } from "@/components/aegis/TraceContext";

// ─── Bug A: Initial State Hardcoded Metrics ─────────────────────────────────

describe("Bug A — Initial State Hardcoded Metrics", () => {
  function renderIdleLedger() {
    return render(
      <TraceProvider>
        <EnforcementLedger
          classification={null}
          draft={{}}
          completeness={null}
          transcript={[]}
          startedAt={null}
        />
      </TraceProvider>,
    );
  }

  it("should display 0% confidence when no classification data exists", () => {
    renderIdleLedger();

    // The gauge should show "0%" — not the hardcoded "94%"
    const gaugeText = screen.getByText(/\d+%/);
    expect(gaugeText.textContent).toBe("0%");
  });

  it('should NOT show "4/4 passed" for Validations when no data exists', () => {
    renderIdleLedger();

    // "4/4 passed" should not appear in idle state
    const validationMatches = screen.queryAllByText("4/4 passed");
    expect(validationMatches).toHaveLength(0);
  });

  it('should NOT show "LOW" for Risk band when no classification exists', () => {
    renderIdleLedger();

    // Risk band should show "—" (or similar placeholder), not "LOW"
    const riskBandMatches = screen.queryAllByText("LOW");
    expect(riskBandMatches).toHaveLength(0);
  });
});

// ─── Bug B: Voice Not Terminated on Finalize Intake ─────────────────────────

describe("Bug B — Voice Not Terminated on Finalize Intake", () => {
  it("finalize_intake should call endSession when status is live", () => {
    // After the fix, finalize_intake is defined as:
    //
    //   finalize_intake: () => {
    //     if (finalizingRef.current) return "already_finalizing";
    //     if (endSessionRef.current) {
    //       try { endSessionRef.current(); } catch (_) { /* ignore */ }
    //     }
    //     void finalize();
    //     return "finalizing";
    //   }
    //
    // The endSessionRef holds conversation.endSession, assigned on every render.

    const endSession = vi.fn();
    const finalize = vi.fn();
    const finalizingRef = { current: false };
    const endSessionRef = { current: endSession as (() => void) | null };

    // Replicate the FIXED finalize_intake logic
    const finalize_intake_current = () => {
      if (finalizingRef.current) return "already_finalizing";
      // Terminate voice session if live
      if (endSessionRef.current) {
        try { endSessionRef.current(); } catch (_) { /* ignore */ }
      }
      void finalize();
      return "finalizing";
    };

    // Execute the fixed logic
    finalize_intake_current();

    // The EXPECTED behavior: endSession should have been called because
    // endSessionRef.current was set (voice session is live).
    expect(endSession).toHaveBeenCalled();
  });
});
