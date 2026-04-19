import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CircleDashed, Database } from "lucide-react";
import type { CaseDraft, ClassifyResult, CompletenessResult } from "@/lib/aegis/types";
import type { TranscriptLine } from "./Transcript";
import { useTrace } from "./TraceContext";

interface Props {
  draft: CaseDraft;
  classification: ClassifyResult | null;
  completeness: CompletenessResult | null;
  transcript: TranscriptLine[];
  startedAt: number | null;
}

interface Row {
  field: string;
  label: string;
  value: string | null;
  category: "TXN" | "MERCHANT" | "INTENT" | "CHANNEL" | "WHEN" | "WHERE";
  source: "CALLER" | "ACCOUNT";
}

const REASON_LABEL: Record<string, string> = {
  unauthorized: "Fraud (Unauthorized)",
  product_not_received: "Product not received",
  product_not_as_described: "Not as described",
  duplicate_charge: "Duplicate charge",
  cancelled_recurring: "Cancelled recurring",
  credit_not_processed: "Credit not processed",
  other: "Other",
};

export const EnforcementLedger = memo(function EnforcementLedger({ draft, classification, completeness, transcript, startedAt }: Props) {
  const { setHovered } = useTrace();
  const callerRows: Row[] = useMemo(() => {
    return [
      {
        field: "amount_cents",
        label: "Transaction",
        category: "TXN",
        source: "CALLER",
        value:
          typeof draft.amount_cents === "number"
            ? `${(draft.amount_cents / 100).toFixed(2)} ${draft.currency ?? "USD"}`
            : null,
      },
      {
        field: "merchant",
        label: "Merchant",
        category: "MERCHANT",
        source: "CALLER",
        value: draft.merchant ?? null,
      },
      {
        field: "transaction_date",
        label: "Date",
        category: "WHEN",
        source: "CALLER",
        value: draft.transaction_date
          ? draft.approx_time_of_day
            ? `${draft.transaction_date} (${draft.approx_time_of_day})`
            : draft.transaction_date
          : null,
      },
      {
        field: "dispute_reason",
        label: "Intent",
        category: "INTENT",
        source: "CALLER",
        value: draft.dispute_reason
          ? REASON_LABEL[draft.dispute_reason] ?? draft.dispute_reason
          : classification
            ? REASON_LABEL[classification.dispute_reason] ?? classification.dispute_reason
            : null,
      },
    ];
  }, [draft, classification]);

  const accountRows: Row[] = useMemo(() => {
    return [
      {
        field: "customer_name",
        label: "Cardholder",
        category: "MERCHANT",
        source: "ACCOUNT",
        value: draft.customer_name ?? null,
      },
      {
        field: "network",
        label: "Network",
        category: "CHANNEL",
        source: "ACCOUNT",
        value: draft.network ? `${draft.network} · Card-on-file` : null,
      },
      {
        field: "last4",
        label: "Card ending",
        category: "CHANNEL",
        source: "ACCOUNT",
        value: draft.last4 ? `•••• ${draft.last4}` : null,
      },
    ];
  }, [draft]);

  const rows = useMemo(() => [...callerRows, ...accountRows], [callerRows, accountRows]);

  const confidence = classification?.confidence ?? draft.classification_confidence ?? 0;

  // Citation timestamps from transcript: pick first line that mentions any captured value
  const citation = (row: Row): string | null => {
    if (!row.value || !startedAt) return null;
    const needle = row.value.split(/\s+/)[0]?.replace(/[$,]/g, "").toLowerCase() ?? "";
    if (!needle) return null;
    const hit = transcript.find((l) => l.text.toLowerCase().includes(needle));
    if (!hit) return null;
    const delta = Math.max(0, Math.floor((new Date(hit.ts).getTime() - startedAt) / 1000));
    return `[${delta}s]`;
  };

  return (
    <section className="flex h-full flex-col rounded-sm border border-border/60 bg-card/40 backdrop-blur-sm shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Database className="h-3.5 w-3.5 text-primary" />
          Extraction & Validation Ledger
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {rows.filter((r) => r.value).length}/{rows.length} VALIDATED
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full font-mono text-[11.5px]">
          <thead className="border-b border-border/40 bg-slate-950/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Field</th>
              <th className="px-4 py-2 text-left font-medium">Value</th>
              <th className="px-4 py-2 text-left font-medium">Source</th>
              <th className="px-4 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <SectionRow label="Caller-provided · Transaction fingerprint" />
            <AnimatePresence>
              {callerRows.map((r) => (
                <LedgerRow
                  key={r.field}
                  row={r}
                  citation={citation(r)}
                  onHover={setHovered}
                />
              ))}
            </AnimatePresence>
            <SectionRow label="Resolved from account · Card on file" />
            <AnimatePresence>
              {accountRows.map((r) => (
                <LedgerRow
                  key={r.field}
                  row={r}
                  citation={null}
                  onHover={setHovered}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="border-t border-border/60 p-4">
        <ConfidenceGauge
          value={confidence}
          missing={completeness?.missing_fields.length ?? 0}
          classification={classification}
          completeness={completeness}
          filledCount={rows.filter((r) => r.value).length}
          totalCount={rows.length}
        />
      </div>
    </section>
  );
});

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="border-b border-border/30 bg-slate-950/30">
      <td colSpan={4} className="px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-primary/60">
        {label}
      </td>
    </tr>
  );
}

function LedgerRow({
  row,
  citation,
  onHover,
}: {
  row: Row;
  citation: string | null;
  onHover: (f: string | null) => void;
}) {
  const has = !!row.value;
  const isAccount = row.source === "ACCOUNT";
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      onMouseEnter={() => onHover(row.field)}
      onMouseLeave={() => onHover(null)}
      className="border-b border-border/30 transition-colors hover:bg-primary/5"
    >
      <td className="px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
          {row.category}
        </span>
        <div className="text-foreground/90">{row.label}</div>
      </td>
      <td className="px-4 py-2.5">
        {has ? (
          <span className="text-foreground">{row.value}</span>
        ) : (
          <span className="text-muted-foreground/50">&lt;pending&gt;</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {isAccount ? (
          <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1 py-px text-[8px] uppercase tracking-wider text-emerald-400">
            account lookup
          </span>
        ) : citation ? (
          <span>{citation}</span>
        ) : has ? (
          <span className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">
            voice
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {has ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="inline-flex items-center gap-1 text-emerald-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            OK
          </motion.span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground/60">
            <CircleDashed className="h-3.5 w-3.5" />
            —
          </span>
        )}
      </td>
    </motion.tr>
  );
}

function ConfidenceGauge({
  value,
  missing,
  classification,
  completeness,
  filledCount,
  totalCount,
}: {
  value: number;
  missing: number;
  classification: ClassifyResult | null;
  completeness: CompletenessResult | null;
  filledCount: number;
  totalCount: number;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[130px] w-[130px]">
        <svg viewBox="0 0 130 130" className="-rotate-90">
          <circle cx="65" cy="65" r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="10" fill="none" />
          <motion.circle
            cx="65"
            cy="65"
            r={r}
            stroke="url(#gauge-grad)"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
            style={{ filter: "drop-shadow(0 0 6px rgba(34, 211, 238, 0.6))" }}
          />
          <defs>
            <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.84 0.14 215)" />
              <stop offset="100%" stopColor="oklch(0.74 0.17 158)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-[26px] font-semibold leading-none text-foreground">
            {Math.round(pct * 100)}%
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Confidence
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 font-mono text-[11px]">
        <Stat label="Schema" value="ISO-20022" tone="primary" />
        <Stat
          label="Validations"
          value={filledCount === 0 && totalCount === 0 ? "—" : filledCount === 0 && !classification && !completeness ? "—" : `${filledCount}/${totalCount} passed`}
          tone={filledCount === totalCount && filledCount > 0 ? "success" : filledCount === 0 && !classification && !completeness ? "primary" : "warn"}
        />
        <Stat label="Missing fields" value={missing === 0 ? "none" : String(missing)} tone={missing === 0 ? "success" : "warn"} />
        <Stat
          label="Risk band"
          value={
            classification == null
              ? "—"
              : classification.confidence >= 0.8
                ? "LOW"
                : classification.confidence >= 0.5
                  ? "MEDIUM"
                  : "HIGH"
          }
          tone={
            classification == null
              ? "primary"
              : classification.confidence >= 0.8
                ? "success"
                : classification.confidence >= 0.5
                  ? "warn"
                  : "warn"
          }
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "primary" | "success" | "warn" }) {
  const color =
    tone === "primary" ? "text-primary" : tone === "success" ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground/80 uppercase tracking-wider text-[10px]">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
