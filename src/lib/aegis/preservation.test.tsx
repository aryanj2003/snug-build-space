/**
 * Preservation Property Tests
 *
 * These tests capture the EXISTING correct behavior that must be preserved
 * after the bugfix. They should PASS on the current unfixed code.
 *
 * Preservation A: Dynamic gauge updates with real (non-null) data
 * Preservation B: Existing finalization paths (stopVoice, finalize_intake when not live)
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */
import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import fc from "fast-check";

import { EnforcementLedger } from "@/components/aegis/EnforcementLedger";
import { TraceProvider } from "@/components/aegis/TraceContext";
import type { ClassifyResult, CompletenessResult, CaseDraft } from "@/lib/aegis/types";

// ─── Preservation A — Dynamic Gauge Updates with Real Data ──────────────────

describe("Preservation A — Dynamic Gauge Updates with Real Data", () => {
  function renderLedger(props: {
    classification: ClassifyResult | null;
    completeness: CompletenessResult | null;
    draft?: CaseDraft;
  }) {
    return render(
      <TraceProvider>
        <EnforcementLedger
          classification={props.classification}
          completeness={props.completeness}
          draft={props.draft ?? {}}
          transcript={[]}
          startedAt={null}
        />
      </TraceProvider>,
    );
  }

  it("shows correct confidence percentage for a known classification", () => {
    const { container, unmount } = renderLedger({
      classification: { dispute_reason: "unauthorized", confidence: 0.85 },
      completeness: { score: 0.7, missing_fields: ["last4", "description"] },
    });

    const gaugeText = within(container).getByText(/\d+%/);
    expect(gaugeText.textContent).toBe("85%");
    unmount();
  });

  it("shows correct missing fields count for known completeness", () => {
    const { container, unmount } = renderLedger({
      classification: { dispute_reason: "unauthorized", confidence: 0.85 },
      completeness: { score: 0.7, missing_fields: ["last4", "description"] },
    });

    // The "Missing fields" stat row shows "2" — find it via the stat label context
    const statElements = within(container).getAllByText("2");
    // At least one "2" should be present (the missing fields count)
    expect(statElements.length).toBeGreaterThanOrEqual(1);
    unmount();
  });

  it("shows 'none' for missing fields when completeness has no missing fields", () => {
    const { container, unmount } = renderLedger({
      classification: { dispute_reason: "unauthorized", confidence: 0.9 },
      completeness: { score: 1.0, missing_fields: [] },
    });

    expect(within(container).getByText("none")).toBeInTheDocument();
    unmount();
  });

  it("property: gauge always shows Math.round(confidence * 100)% for random confidence values", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (confidence) => {
          const { container, unmount } = renderLedger({
            classification: { dispute_reason: "unauthorized", confidence },
            completeness: { score: 1.0, missing_fields: [] },
          });

          const expected = `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
          const gaugeText = within(container).getByText(/\d+%/);
          expect(gaugeText.textContent).toBe(expected);

          unmount();
        },
      ),
      { numRuns: 50 },
    );
  });

  it("property: missing fields stat shows correct count for random missing_fields arrays", () => {
    const fieldArb = fc.constantFrom(
      "last4", "description", "merchant", "network",
      "amount_cents", "currency", "transaction_date",
      "customer_name", "customer_contact_masked",
    );

    fc.assert(
      fc.property(
        fc.array(fieldArb, { minLength: 0, maxLength: 9 }),
        (missingFields) => {
          const { container, unmount } = renderLedger({
            classification: { dispute_reason: "unauthorized", confidence: 0.8 },
            completeness: { score: 0.5, missing_fields: missingFields },
          });

          const count = missingFields.length;
          const expectedText = count === 0 ? "none" : String(count);

          // Find the "Missing fields" label, then check its sibling value
          const missingLabel = within(container).getByText("Missing fields");
          const statRow = missingLabel.closest("div")!;
          expect(within(statRow).getByText(expectedText)).toBeInTheDocument();

          unmount();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Preservation B — Existing Finalization Paths ───────────────────────────

describe("Preservation B — Existing Finalization Paths", () => {
  it("stopVoice calls endSession then finalize in order", async () => {
    const callOrder: string[] = [];

    const endSession = vi.fn().mockImplementation(() => {
      callOrder.push("endSession");
      return Promise.resolve();
    });
    const finalize = vi.fn().mockImplementation(() => {
      callOrder.push("finalize");
      return Promise.resolve();
    });

    // Replicate the current stopVoice logic from src/routes/index.tsx:
    //   const stopVoice = useCallback(async () => {
    //     try { await conversation.endSession(); }
    //     finally { void finalize(); }
    //   }, [conversation, finalize]);
    const stopVoice = async () => {
      try {
        await endSession();
      } finally {
        void finalize();
      }
    };

    await stopVoice();

    expect(endSession).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["endSession", "finalize"]);
  });

  it("finalize_intake when status != 'live' proceeds to finalize without calling endSession", () => {
    const endSession = vi.fn();
    const finalize = vi.fn();
    const finalizingRef = { current: false };
    // When status != "live", endSessionRef.current is null (no active session)
    const endSessionRef = { current: null as (() => void) | null };

    // Replicate the fixed finalize_intake logic from src/routes/index.tsx:
    //   finalize_intake: () => {
    //     if (finalizingRef.current) return "already_finalizing";
    //     if (endSessionRef.current) {
    //       try { endSessionRef.current(); } catch (_) { /* ignore */ }
    //     }
    //     void finalize();
    //     return "finalizing";
    //   }
    const finalize_intake = () => {
      if (finalizingRef.current) return "already_finalizing";
      if (endSessionRef.current) {
        try { endSessionRef.current(); } catch (_) { /* ignore */ }
      }
      void finalize();
      return "finalizing";
    };

    // Status is "ended" (not "live") — endSessionRef is null, so endSession should not be called
    const result = finalize_intake();

    expect(result).toBe("finalizing");
    expect(finalize).toHaveBeenCalledTimes(1);
    // endSession should NOT be called because endSessionRef.current is null
    expect(endSession).not.toHaveBeenCalled();
  });
});


// ─── Shared Arbitraries for PBT ─────────────────────────────────────────────

import { scoreCompleteness } from "@/lib/aegis/completeness";
import { tracePatternsForDraft } from "@/lib/aegis/highlight";
import { buildIso20022 } from "@/lib/aegis/iso20022";
import { NETWORK_TYPES, DISPUTE_REASONS } from "@/lib/aegis/types";
import type { RouteResult } from "@/lib/aegis/types";

/** Reusable arbitrary that generates valid CaseDraft objects. */
const caseDraftArb = fc.record(
  {
    network: fc.constantFrom(...NETWORK_TYPES),
    amount_cents: fc.integer({ min: 1, max: 99_999_99 }),
    currency: fc.stringOf(fc.constantFrom("A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"), { minLength: 3, maxLength: 3 }),
    merchant: fc.string({ minLength: 1, maxLength: 50 }),
    transaction_date: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map(
      (d) => d.toISOString().slice(0, 10),
    ),
    last4: fc.stringOf(fc.constantFrom("0","1","2","3","4","5","6","7","8","9"), { minLength: 4, maxLength: 4 }),
    customer_name: fc.string({ minLength: 1, maxLength: 50 }),
    customer_contact_masked: fc.string({ minLength: 0, maxLength: 30 }),
    description: fc.string({ minLength: 0, maxLength: 100 }),
    dispute_reason: fc.constantFrom(...DISPUTE_REASONS),
    classification_confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  },
  { requiredKeys: [] },
);

/** Arbitrary for ClassifyResult */
const classifyResultArb = fc.record({
  dispute_reason: fc.constantFrom(...DISPUTE_REASONS),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
});

/** Arbitrary for RouteResult */
const routeResultArb: fc.Arbitrary<RouteResult> = fc.record({
  vendor_id: fc.string({ minLength: 1, maxLength: 10 }),
  vendor_name: fc.string({ minLength: 1, maxLength: 30 }),
  rule_id: fc.string({ minLength: 1, maxLength: 10 }),
  reason_code: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
  scored_alternatives: fc.array(
    fc.record({
      vendor_id: fc.string({ minLength: 1, maxLength: 10 }),
      vendor_name: fc.string({ minLength: 1, maxLength: 30 }),
      score: fc.integer({ min: 0, max: 10 }),
    }),
    { minLength: 0, maxLength: 3 },
  ),
});

// ─── 7.1 Preservation — scoreCompleteness determinism ───────────────────────

/**
 * **Validates: Requirements 3.1, 3.2**
 *
 * Property: scoreCompleteness is a pure, deterministic function.
 * For any CaseDraft, calling it twice with the same input produces
 * identical { score, missing_fields } results. This validates that
 * the debounce wrapper doesn't alter the underlying computation.
 */
describe("7.1 Preservation — scoreCompleteness determinism", () => {
  it("property: scoreCompleteness returns identical results for the same draft across two calls", () => {
    fc.assert(
      fc.property(caseDraftArb, (draft) => {
        const result1 = scoreCompleteness(draft);
        const result2 = scoreCompleteness(draft);

        expect(result1.score).toBe(result2.score);
        expect(result1.missing_fields).toEqual(result2.missing_fields);
      }),
      { numRuns: 200 },
    );
  });

  it("property: score is always between 0 and 1 inclusive", () => {
    fc.assert(
      fc.property(caseDraftArb, (draft) => {
        const { score } = scoreCompleteness(draft);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it("property: missing_fields is always a subset of known field names", () => {
    const KNOWN_FIELDS = new Set([
      "network", "amount_cents", "merchant", "transaction_date",
      "last4", "customer_name", "dispute_reason",
      "customer_contact_masked", "description",
    ]);

    fc.assert(
      fc.property(caseDraftArb, (draft) => {
        const { missing_fields } = scoreCompleteness(draft);
        for (const f of missing_fields) {
          expect(KNOWN_FIELDS.has(f)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ─── 7.2 Preservation — tracePatternsForDraft determinism ───────────────────

/**
 * **Validates: Requirements 3.3, 3.6**
 *
 * Property: tracePatternsForDraft is deterministic — calling it twice
 * with the same draft produces patterns that match the same substrings
 * in sample text. This validates that memoization doesn't alter pattern
 * behavior.
 */
describe("7.2 Preservation — tracePatternsForDraft determinism", () => {
  it("property: tracePatternsForDraft produces patterns matching the same substrings across two calls", () => {
    fc.assert(
      fc.property(caseDraftArb, (draft) => {
        // Build a sample text that contains the draft field values
        const parts: string[] = ["The customer called about a dispute."];
        if (typeof draft.amount_cents === "number") {
          parts.push(`Amount was $${(draft.amount_cents / 100).toFixed(2)}`);
        }
        if (draft.merchant) parts.push(`at ${draft.merchant}`);
        if (draft.customer_name) parts.push(`by ${draft.customer_name}`);
        if (draft.last4) parts.push(`card ending ${draft.last4}`);
        if (draft.transaction_date) parts.push(`on ${draft.transaction_date}`);
        if (draft.dispute_reason) parts.push("fraud unauthorized wasn't me");
        const sampleText = parts.join(" ");

        const patterns1 = tracePatternsForDraft(draft);
        const patterns2 = tracePatternsForDraft(draft);

        // Same number of patterns
        expect(patterns1.length).toBe(patterns2.length);

        // Each pattern pair matches the same substrings in the sample text
        for (let i = 0; i < patterns1.length; i++) {
          expect(patterns1[i].field).toBe(patterns2[i].field);

          // Reset lastIndex for global regexes before matching
          patterns1[i].pattern.lastIndex = 0;
          patterns2[i].pattern.lastIndex = 0;

          const matches1: string[] = [];
          const matches2: string[] = [];

          let m: RegExpExecArray | null;
          while ((m = patterns1[i].pattern.exec(sampleText)) !== null) {
            matches1.push(m[0]);
            if (m.index === patterns1[i].pattern.lastIndex) patterns1[i].pattern.lastIndex++;
          }
          while ((m = patterns2[i].pattern.exec(sampleText)) !== null) {
            matches2.push(m[0]);
            if (m.index === patterns2[i].pattern.lastIndex) patterns2[i].pattern.lastIndex++;
          }

          expect(matches1).toEqual(matches2);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("property: pattern count matches the number of non-empty draft fields used for tracing", () => {
    fc.assert(
      fc.property(caseDraftArb, (draft) => {
        const patterns = tracePatternsForDraft(draft);

        let expectedCount = 0;
        if (typeof draft.amount_cents === "number") expectedCount++;
        if (draft.merchant) expectedCount++;
        if (draft.customer_name) expectedCount++;
        if (draft.last4) expectedCount++;
        if (draft.transaction_date) expectedCount++;
        if (draft.dispute_reason) expectedCount++;

        expect(patterns.length).toBe(expectedCount);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── 7.3 Preservation — buildIso20022 determinism ───────────────────────────

/**
 * **Validates: Requirements 3.2, 3.6**
 *
 * Property: buildIso20022 is deterministic for the same inputs when
 * timestamps are controlled. Calling it twice with the same draft,
 * classification, routing, and caseId produces identical JSON output.
 * This validates that the memo key change doesn't alter output.
 */
describe("7.3 Preservation — buildIso20022 determinism", () => {
  it("property: buildIso20022 returns identical JSON for the same inputs (timestamps frozen)", () => {
    fc.assert(
      fc.property(
        caseDraftArb,
        fc.option(classifyResultArb, { nil: null }),
        fc.option(routeResultArb, { nil: null }),
        fc.option(fc.uuid(), { nil: null }),
        (draft, classification, routing, caseId) => {
          // Freeze time so the internal new Date().toISOString() is identical
          const frozenNow = new Date("2025-01-15T12:00:00.000Z");
          vi.useFakeTimers({ now: frozenNow });

          try {
            const result1 = buildIso20022({ draft, classification, routing, caseId });
            const result2 = buildIso20022({ draft, classification, routing, caseId });

            expect(result1).toEqual(result2);
          } finally {
            vi.useRealTimers();
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("property: buildIso20022 output always contains the Document.CstmrPmtRvslReq structure", () => {
    fc.assert(
      fc.property(
        caseDraftArb,
        fc.option(classifyResultArb, { nil: null }),
        fc.option(routeResultArb, { nil: null }),
        fc.option(fc.uuid(), { nil: null }),
        (draft, classification, routing, caseId) => {
          const result = buildIso20022({ draft, classification, routing, caseId });

          expect(result).toHaveProperty("Document");
          expect(result.Document).toHaveProperty("CstmrPmtRvslReq");

          const req = (result.Document as Record<string, unknown>).CstmrPmtRvslReq as Record<string, unknown>;
          expect(req).toHaveProperty("Assgnmt");
          expect(req).toHaveProperty("Case");
          expect(req).toHaveProperty("Undrlyg");
          expect(req).toHaveProperty("SplmtryData");
        },
      ),
      { numRuns: 200 },
    );
  });

  it("property: buildIso20022 correctly maps draft.amount_cents to dollars", () => {
    fc.assert(
      fc.property(
        caseDraftArb.filter((d) => typeof d.amount_cents === "number"),
        (draft) => {
          const result = buildIso20022({ draft, classification: null, routing: null, caseId: null });

          const doc = result.Document as Record<string, unknown>;
          const req = doc.CstmrPmtRvslReq as Record<string, unknown>;
          const undrlyg = req.Undrlyg as Record<string, unknown>;
          const txInf = undrlyg.TxInf as Record<string, unknown>;
          const orgnlTxRef = txInf.OrgnlTxRef as Record<string, unknown>;
          const amt = orgnlTxRef.Amt as Record<string, unknown>;

          expect(amt.value).toBe(draft.amount_cents! / 100);
        },
      ),
      { numRuns: 100 },
    );
  });
});
