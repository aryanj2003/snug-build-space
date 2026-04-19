import type { CaseDraft, RouteResult, NetworkType, DisputeReason } from "./types";

export interface VendorRow {
  id: string;
  name: string;
  supports_networks: NetworkType[];
  supports_reasons: DisputeReason[];
  reason_code_map: Record<string, string>;
  active: boolean;
}

export interface RuleRow {
  id: string;
  priority: number;
  network: NetworkType | null;
  reason: DisputeReason | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
  vendor_id: string;
  reason_code: string | null;
  active: boolean;
}

function ruleMatches(rule: RuleRow, draft: CaseDraft): boolean {
  if (!rule.active) return false;
  if (rule.network && draft.network !== rule.network) return false;
  if (rule.reason && draft.dispute_reason !== rule.reason) return false;
  if (rule.min_amount_cents != null) {
    if (!draft.amount_cents || draft.amount_cents < rule.min_amount_cents) return false;
  }
  if (rule.max_amount_cents != null) {
    if (!draft.amount_cents || draft.amount_cents > rule.max_amount_cents) return false;
  }
  return true;
}

function scoreVendor(v: VendorRow, draft: CaseDraft): number {
  let s = 0;
  if (draft.network && v.supports_networks.includes(draft.network)) s += 2;
  if (draft.dispute_reason && v.supports_reasons.includes(draft.dispute_reason)) s += 2;
  if (draft.dispute_reason && v.reason_code_map[draft.dispute_reason]) s += 1;
  return s;
}

export function route(draft: CaseDraft, rules: RuleRow[], vendors: VendorRow[]): RouteResult {
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  const matched = sortedRules.find((r) => ruleMatches(r, draft));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  let chosenVendorId: string;
  let ruleId: string;
  let reasonCode: string | null = null;

  if (matched) {
    chosenVendorId = matched.vendor_id;
    ruleId = matched.id;
    const vendor = vendorById.get(chosenVendorId);
    reasonCode =
      matched.reason_code ??
      (draft.dispute_reason && vendor ? vendor.reason_code_map[draft.dispute_reason] ?? null : null);
  } else {
    // Tiebreaker: best-scoring vendor among active
    const ranked = vendors
      .filter((v) => v.active)
      .map((v) => ({ v, score: scoreVendor(v, draft) }))
      .sort((a, b) => b.score - a.score);
    const winner = ranked[0]?.v;
    chosenVendorId = winner?.id ?? "I01";
    ruleId = "TIEBREAKER";
    reasonCode =
      winner && draft.dispute_reason ? winner.reason_code_map[draft.dispute_reason] ?? null : null;
  }

  const chosen = vendorById.get(chosenVendorId);
  const alternatives = vendors
    .filter((v) => v.active && v.id !== chosenVendorId)
    .map((v) => ({ vendor_id: v.id, vendor_name: v.name, score: scoreVendor(v, draft) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    vendor_id: chosenVendorId,
    vendor_name: chosen?.name ?? chosenVendorId,
    rule_id: ruleId,
    reason_code: reasonCode,
    scored_alternatives: alternatives,
  };
}
