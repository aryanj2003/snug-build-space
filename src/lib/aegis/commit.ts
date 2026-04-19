import { supabase } from "@/integrations/supabase/client";
import type { CaseDraft, RouteResult, CompletenessResult, AuditEventInput } from "./types";
import { redact, redactObject } from "./redact";
import { computeHash } from "./hashChain";

export interface CommitInput {
  draft: CaseDraft;
  classification: { dispute_reason: NonNullable<CaseDraft["dispute_reason"]>; confidence: number };
  completeness: CompletenessResult;
  routing: RouteResult;
  transcript: string;
  fieldEvents: Array<{ field: string; value: unknown; at: string }>;
}

export interface CommitOutput {
  case_id: string;
  audit_count: number;
}

export async function commitCase(input: CommitInput): Promise<CommitOutput> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not authenticated");
  const userId = userData.user.id;

  const redactedTranscript = redact(input.transcript);
  const redactedDraft: CaseDraft = redactObject(input.draft);

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .insert({
      user_id: userId,
      status: "committed",
      network: redactedDraft.network ?? null,
      amount_cents: redactedDraft.amount_cents ?? null,
      currency: redactedDraft.currency ?? "USD",
      merchant: redactedDraft.merchant ?? null,
      transaction_date: redactedDraft.transaction_date ?? null,
      last4: redactedDraft.last4 ?? null,
      customer_name: redactedDraft.customer_name ?? null,
      customer_contact_masked: redactedDraft.customer_contact_masked ?? null,
      description: redactedDraft.description ?? null,
      dispute_reason: input.classification.dispute_reason,
      classification_confidence: input.classification.confidence,
      completeness_score: input.completeness.score,
      missing_fields: input.completeness.missing_fields,
      routed_vendor_id: input.routing.vendor_id,
      routed_rule_id: input.routing.rule_id === "TIEBREAKER" ? null : input.routing.rule_id,
      routed_reason_code: input.routing.reason_code,
      scored_alternatives: input.routing.scored_alternatives,
      raw_transcript: redactedTranscript,
    })
    .select("id")
    .single();

  if (caseErr || !caseRow) throw new Error(caseErr?.message ?? "Failed to insert case");
  const caseId = caseRow.id as string;

  // Build audit chain
  const events: AuditEventInput[] = [];
  events.push({ seq: 1, event_type: "session_started", payload: { ts: new Date().toISOString() } });
  for (const fe of input.fieldEvents) {
    events.push({
      seq: events.length + 1,
      event_type: "field_captured",
      payload: { field: fe.field, value: redactObject(fe.value), at: fe.at },
    });
  }
  events.push({
    seq: events.length + 1,
    event_type: "classified",
    payload: { ...input.classification },
  });
  events.push({
    seq: events.length + 1,
    event_type: "completeness_scored",
    payload: { score: input.completeness.score, missing_fields: input.completeness.missing_fields },
  });
  events.push({
    seq: events.length + 1,
    event_type: "routed",
    payload: {
      vendor_id: input.routing.vendor_id,
      rule_id: input.routing.rule_id,
      reason_code: input.routing.reason_code,
    },
  });
  events.push({
    seq: events.length + 1,
    event_type: "committed",
    payload: { case_id: caseId },
  });

  type AuditRow = {
    case_id: string;
    user_id: string;
    seq: number;
    event_type: AuditEventInput["event_type"];
    payload: Record<string, unknown>;
    prev_hash: string | null;
    hash: string;
    created_at: string;
  };
  let prevHash: string | null = null;
  const rows: AuditRow[] = [];
  for (const ev of events) {
    const created_at = new Date().toISOString();
    const hash = await computeHash({
      case_id: caseId,
      seq: ev.seq,
      event_type: ev.event_type,
      payload: ev.payload,
      prev_hash: prevHash,
      created_at,
    });
    rows.push({
      case_id: caseId,
      user_id: userId,
      seq: ev.seq,
      event_type: ev.event_type,
      payload: ev.payload,
      prev_hash: prevHash,
      hash,
      created_at,
    });
    prevHash = hash;
  }

  const { error: evErr } = await supabase.from("audit_events").insert(rows as never);
  if (evErr) throw new Error(evErr.message);

  return { case_id: caseId, audit_count: rows.length };
}

export async function verifyChain(
  caseId: string,
): Promise<{ valid: boolean; checked: number; brokenAt?: number }> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("seq,event_type,payload,prev_hash,hash,case_id,created_at")
    .eq("case_id", caseId)
    .order("seq", { ascending: true });
  if (error || !data) return { valid: false, checked: 0 };

  let prev: string | null = null;
  for (const row of data) {
    const expected = await computeHash({
      case_id: row.case_id as string,
      seq: row.seq as number,
      event_type: row.event_type as string,
      payload: row.payload as Record<string, unknown>,
      prev_hash: prev,
      created_at: row.created_at as string,
    });
    if (expected !== row.hash || row.prev_hash !== prev) {
      return { valid: false, checked: data.length, brokenAt: row.seq as number };
    }
    prev = row.hash as string;
  }
  return { valid: true, checked: data.length };
}
