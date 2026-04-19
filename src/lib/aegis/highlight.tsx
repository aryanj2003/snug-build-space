import type { ReactNode } from "react";
import type { CaseDraft } from "./types";

// Static keywords always highlighted in cyan.
const STATIC_KEYWORDS = [
  /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi, // dollar amounts
  /gas\s+station/gi,
  /wasn'?t\s+me/gi,
  /didn'?t\s+authorize/gi,
  /\bfraud(?:ulent)?\b/gi,
];

export interface TraceTerm {
  field: string;
  pattern: RegExp;
}

export function tracePatternsForDraft(draft: CaseDraft): TraceTerm[] {
  const out: TraceTerm[] = [];
  if (typeof draft.amount_cents === "number") {
    const dollars = (draft.amount_cents / 100).toFixed(2).replace(/\.00$/, "");
    out.push({
      field: "amount_cents",
      pattern: new RegExp(
        `\\$?\\s?${dollars.replace(/\./g, "\\.")}\\b|\\$\\s?${Math.round(draft.amount_cents / 100)}\\b`,
        "gi",
      ),
    });
  }
  if (draft.merchant) {
    out.push({ field: "merchant", pattern: new RegExp(escape(draft.merchant), "gi") });
  }
  if (draft.customer_name) {
    out.push({ field: "customer_name", pattern: new RegExp(`\\b${escape(draft.customer_name)}\\b`, "gi") });
  }
  if (draft.last4) {
    out.push({ field: "last4", pattern: new RegExp(`\\b${escape(draft.last4)}\\b`, "g") });
  }
  if (draft.transaction_date) {
    out.push({ field: "transaction_date", pattern: new RegExp(escape(draft.transaction_date), "g") });
  }
  if (draft.dispute_reason) {
    out.push({ field: "dispute_reason", pattern: /\b(fraud|wasn'?t me|didn'?t authorize|unauthorized)\b/gi });
  }
  return out;
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Match {
  start: number;
  end: number;
  field: string | null; // null = static keyword
}

export function highlight(
  text: string,
  hoveredField: string | null,
  traceTerms: TraceTerm[],
): ReactNode {
  const matches: Match[] = [];

  for (const re of STATIC_KEYWORDS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, field: null });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  for (const t of traceTerms) {
    t.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = t.pattern.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, field: t.field });
      if (m.index === t.pattern.lastIndex) t.pattern.lastIndex++;
    }
  }

  if (matches.length === 0) return text;
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  // De-overlap (keep earliest, drop overlapping)
  const merged: Match[] = [];
  let cursor = -1;
  for (const m of matches) {
    if (m.start >= cursor) {
      merged.push(m);
      cursor = m.end;
    }
  }

  const out: ReactNode[] = [];
  let pos = 0;
  merged.forEach((m, i) => {
    if (m.start > pos) out.push(text.slice(pos, m.start));
    const isTraced = m.field && hoveredField === m.field;
    out.push(
      <span key={i} className={isTraced ? "trace-hit kw-hit" : "kw-hit"}>
        {text.slice(m.start, m.end)}
      </span>,
    );
    pos = m.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}
