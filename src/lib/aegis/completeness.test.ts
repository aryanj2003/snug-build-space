import { describe, it, expect } from "vitest";
import { scoreCompleteness } from "./completeness";
import type { CaseDraft } from "./types";

describe("scoreCompleteness", () => {
  it("returns 0 score and all required fields missing for empty draft", () => {
    const result = scoreCompleteness({});
    expect(result.score).toBe(0);
    expect(result.missing_fields).toContain("merchant");
    expect(result.missing_fields).toContain("amount_cents");
    expect(result.missing_fields).toContain("transaction_date");
    expect(result.missing_fields).toContain("dispute_reason");
    expect(result.missing_fields.length).toBe(4);
  });

  it("returns 1.0 when all required fields are present", () => {
    const draft: CaseDraft = {
      amount_cents: 10000,
      merchant: "Test Merchant",
      transaction_date: "2026-01-15",
      dispute_reason: "duplicate_charge",
    };
    const result = scoreCompleteness(draft);
    expect(result.score).toBe(1);
    expect(result.missing_fields).toEqual([]);
  });

  it("includes conditional description field for product_not_received reason", () => {
    const draft: CaseDraft = {
      amount_cents: 5000,
      merchant: "Shop",
      transaction_date: "2026-02-01",
      dispute_reason: "product_not_received",
      // missing: description (conditional for product_not_received)
    };
    const result = scoreCompleteness(draft);
    expect(result.score).toBeLessThan(1);
    expect(result.missing_fields).toContain("description");
  });

  it("includes conditional description field for product_not_as_described reason", () => {
    const draft: CaseDraft = {
      amount_cents: 5000,
      merchant: "Shop",
      transaction_date: "2026-02-01",
      dispute_reason: "product_not_as_described",
      // missing: description (conditional)
    };
    const result = scoreCompleteness(draft);
    expect(result.missing_fields).toContain("description");
  });

  it("calculates partial score correctly", () => {
    const draft: CaseDraft = {
      amount_cents: 10000,
      merchant: "Test",
      // missing: transaction_date, dispute_reason
    };
    const result = scoreCompleteness(draft);
    // 2 present out of 4 required
    expect(result.score).toBeCloseTo(2 / 4, 5);
    expect(result.missing_fields.length).toBe(2);
  });
});
