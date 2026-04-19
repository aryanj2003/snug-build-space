import { describe, it, expect } from "vitest";
import { route, type VendorRow, type RuleRow } from "./router";
import type { CaseDraft } from "./types";

// Minimal vendor/rule fixtures matching the seed data
const vendors: VendorRow[] = [
  {
    id: "V01",
    name: "Visa TC40 Direct",
    supports_networks: ["VISA"],
    supports_reasons: ["unauthorized", "product_not_received"],
    reason_code_map: { unauthorized: "10.4", product_not_received: "13.1" },
    active: true,
  },
  {
    id: "V02",
    name: "Visa VROL",
    supports_networks: ["VISA"],
    supports_reasons: ["unauthorized", "product_not_received", "duplicate_charge"],
    reason_code_map: { unauthorized: "10.4", product_not_received: "13.1", duplicate_charge: "12.6.1" },
    active: true,
  },
  {
    id: "M01",
    name: "Mastercard SAFE",
    supports_networks: ["MC"],
    supports_reasons: ["unauthorized", "duplicate_charge"],
    reason_code_map: { unauthorized: "4837", duplicate_charge: "4834" },
    active: true,
  },
  {
    id: "C01",
    name: "Chargeback911",
    supports_networks: ["VISA", "MC", "AMEX", "DISCOVER"],
    supports_reasons: ["unauthorized", "product_not_received", "duplicate_charge", "other"],
    reason_code_map: {},
    active: true,
  },
  {
    id: "I01",
    name: "Internal Ops Queue",
    supports_networks: ["VISA", "MC", "AMEX", "DISCOVER", "OTHER"],
    supports_reasons: ["unauthorized", "other"],
    reason_code_map: {},
    active: true,
  },
];

const rules: RuleRow[] = [
  { id: "R01", priority: 10, network: "VISA", reason: "unauthorized", min_amount_cents: 10000, max_amount_cents: null, vendor_id: "V01", reason_code: "10.4", active: true },
  { id: "R02", priority: 20, network: "VISA", reason: null, min_amount_cents: null, max_amount_cents: null, vendor_id: "V02", reason_code: null, active: true },
  { id: "R03", priority: 30, network: "MC", reason: null, min_amount_cents: null, max_amount_cents: null, vendor_id: "M01", reason_code: null, active: true },
  { id: "R04", priority: 90, network: null, reason: null, min_amount_cents: null, max_amount_cents: null, vendor_id: "C01", reason_code: null, active: true },
];

describe("route", () => {
  it("routes VISA unauthorized >= $100 to TC40 (R01)", () => {
    const draft: CaseDraft = {
      network: "VISA",
      dispute_reason: "unauthorized",
      amount_cents: 84700,
    };
    const result = route(draft, rules, vendors);
    expect(result.vendor_id).toBe("V01");
    expect(result.rule_id).toBe("R01");
    expect(result.reason_code).toBe("10.4");
    expect(result.vendor_name).toBe("Visa TC40 Direct");
  });

  it("routes VISA unauthorized < $100 to VROL (R02, not R01)", () => {
    const draft: CaseDraft = {
      network: "VISA",
      dispute_reason: "unauthorized",
      amount_cents: 5000, // $50
    };
    const result = route(draft, rules, vendors);
    expect(result.vendor_id).toBe("V02");
    expect(result.rule_id).toBe("R02");
  });

  it("routes VISA non-unauthorized to VROL (R02)", () => {
    const draft: CaseDraft = {
      network: "VISA",
      dispute_reason: "duplicate_charge",
      amount_cents: 20000,
    };
    const result = route(draft, rules, vendors);
    expect(result.vendor_id).toBe("V02");
    expect(result.rule_id).toBe("R02");
  });

  it("routes Mastercard to SAFE (R03)", () => {
    const draft: CaseDraft = {
      network: "MC",
      dispute_reason: "unauthorized",
      amount_cents: 15000,
    };
    const result = route(draft, rules, vendors);
    expect(result.vendor_id).toBe("M01");
    expect(result.rule_id).toBe("R03");
    // reason_code comes from vendor's reason_code_map since rule has null
    expect(result.reason_code).toBe("4837");
  });

  it("falls back to Chargeback911 for AMEX (R04)", () => {
    const draft: CaseDraft = {
      network: "AMEX",
      dispute_reason: "other",
      amount_cents: 3000,
    };
    const result = route(draft, rules, vendors);
    expect(result.vendor_id).toBe("C01");
    expect(result.rule_id).toBe("R04");
  });

  it("uses tiebreaker when no rules match", () => {
    const draft: CaseDraft = {
      network: "VISA",
      dispute_reason: "unauthorized",
      amount_cents: 84700,
    };
    // Pass empty rules
    const result = route(draft, [], vendors);
    expect(result.rule_id).toBe("TIEBREAKER");
    // Should pick best-scoring vendor for VISA + unauthorized
    expect(result.vendor_id).toBe("V01");
  });

  it("includes scored alternatives", () => {
    const draft: CaseDraft = {
      network: "VISA",
      dispute_reason: "unauthorized",
      amount_cents: 84700,
    };
    const result = route(draft, rules, vendors);
    expect(result.scored_alternatives.length).toBeGreaterThan(0);
    // Alternatives should not include the chosen vendor
    expect(result.scored_alternatives.every((a) => a.vendor_id !== result.vendor_id)).toBe(true);
  });
});
