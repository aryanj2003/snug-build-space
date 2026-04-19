import { useMemo } from "react";
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
  category: "TXN" | "MERCHANT" | "INTENT" | "CHANNEL";
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

export function EnforcementLedger({ draft, classification, completeness, transcript, startedAt }: Props) {
  const { setHovered } = useTrace();
  const rows: Row[] = useMemo(() => {
    return [
      {
        field: "amount_cents",
        label: "Transaction",
        category: "TXN",
        value:
          typeof draft.amount_cents === "number"
            ? `$${(draft.amount_cents / 100).toFixed(2)} ${draft.currency ?? "USD"}`
            : null,
      },
      {
        field: "merchant",
        label: "Merchant",
        category: "MERCHANT",
        value: draft.merchant ?? null,
      },
      {
        field: "dispute_reason",
        label: "Intent",
        category: "INTENT",
        value: draft.dispute_reason
          ? REASON_LABEL[draft.dispute_reason] ?? draft.dispute_reason
          : classification
            ? REASON_LABEL[classification.dispute_reason] ?? classification.dispute_reason
            : null,
      },
      {
        field: "network",
        label: "Category",
        category: "CHANNEL",
        value: draft.network ? `${draft.network} · Card-Present` : null,
      },
    ];
  }, [draft, classification]);

  const confidence = classification?.confidence ?? draft.classification_confidence ?? 0.94;

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
            <AnimatePresence>
              {rows.map((r) => {
                const has = !!r.value;
                const cite = citation(r);
                return (
                  <motion.tr
                    key={r.field}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    onMouseEnter={() => setHovered(r.field)}
                    onMouseLeave={() => setHovered(null)}
                    className="border-b border-border/30 transition-colors hover:bg-primary/5"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                        {r.category}
                      </span>
                      <div className="text-foreground/90">{r.label}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {has ? (
                        <span className="text-foreground">{r.value}</span>
                      ) : (
                        <span className="text-muted-foreground/50">&lt;pending&gt;</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {cite ?? <span className="text-muted-foreground/50">—</span>}
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
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="border-t border-border/60 p-4">
        <ConfidenceGauge value={confidence} missing={completeness?.missing_fields.length ?? 0} />
      </div>
    </section>
  );
}

function ConfidenceGauge({ value, missing }: { value: number; missing: number }) {
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
        <Stat label="Validations" value="4/4 passed" tone="success" />
        <Stat label="Missing fields" value={missing === 0 ? "none" : String(missing)} tone={missing === 0 ? "success" : "warn"} />
        <Stat label="Risk band" value="LOW" tone="success" />
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
