import { describe, it, expect } from "vitest";
import { scoreCompleteness } from "./completeness";
import type { CaseDraft } from "./types";

describe("scoreCompleteness", () => {
  it("returns 0 score and all required fields missing for empty draft", () => {
    const result = scoreCompleteness({});
    expect(result.score).toBe(0);
    expect(result.missing_fields).toContain("network");
    expect(result.missing_fields).toContain("amount_cents");
    expect(result.missing_fields).toContain("merchant");
    expect(result.missing_fields).toContain("transaction_date");
    expect(result.missing_fields).toContain("last4");
    expect(result.missing_fields).toContain("customer_name");
    expect(result.missing_fields).toContain("dispute_reason");
    expect(result.missing_fields.length).toBe(7);
  });

  it("returns 1.0 when all required fields are present", () => {
    const draft: CaseDraft = {
      network: "VISA",
      amount_cents: 10000,
      merchant: "Test Merchant",
      transaction_date: "2026-01-15",
      last4: "1234",
      customer_name: "Jane Doe",
      dispute_reason: "duplicate_charge",
    };
    const result = scoreCompleteness(draft);
    expect(result.score).toBe(1);
    expect(result.missing_fields).toEqual([]);
  });

  it("includes conditional fields for unauthorized reason", () => {
    const draft: CaseDraft = {
      network: "VISA",
      amount_cents: 10000,
      merchant: "Test",
      transaction_date: "2026-01-15",
      last4: "1234",
      customer_name: "Jane",
      dispute_reason: "unauthorized",
      // missing: customer_contact_masked (conditional for unauthorized)
    };
    const result = scoreCompleteness(draft);
    expect(result.score).toBeLessThan(1);
    expect(result.missing_fields).toContain("customer_contact_masked");
  });

  it("includes conditional fields for product_not_received reason", () => {
    const draft: CaseDraft = {
      network: "MC",
      amount_cents: 5000,
      merchant: "Shop",
      transaction_date: "2026-02-01",
      last4: "5678",
      customer_name: "John",
      dispute_reason: "product_not_received",
      // missing: description (conditional)
    };
    const result = scoreCompleteness(draft);
    expect(result.missing_fields).toContain("description");
  });

  it("calculates partial score correctly", () => {
    const draft: CaseDraft = {
      network: "VISA",
      amount_cents: 10000,
      merchant: "Test",
      // missing: transaction_date, last4, customer_name, dispute_reason
    };
    const result = scoreCompleteness(draft);
    // 3 present out of 7 required
    expect(result.score).toBeCloseTo(3 / 7, 5);
    expect(result.missing_fields.length).toBe(4);
  });
});
