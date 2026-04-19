import { useMemo } from "react";
import { motion } from "framer-motion";
import { Send, Code2, Network, Loader2 } from "lucide-react";
import type { CaseDraft, ClassifyResult, CompletenessResult, RouteResult } from "@/lib/aegis/types";
import { buildIso20022, syntaxHighlightJson } from "@/lib/aegis/iso20022";

interface Props {
  draft: CaseDraft;
  classification: ClassifyResult | null;
  routing: RouteResult | null;
  caseId: string | null;
  completeness: CompletenessResult | null;
  status: "idle" | "connecting" | "live" | "ended";
  onValidateRoute: () => void;
  finalizing: boolean;
}

export function SystemOutput({
  draft,
  classification,
  routing,
  caseId,
  completeness,
  status,
  onValidateRoute,
  finalizing,
}: Props) {
  const json = useMemo(
    () => buildIso20022({ draft, classification, routing, caseId }),
    [draft, classification, routing, caseId],
  );
  const html = useMemo(() => syntaxHighlightJson(JSON.stringify(json, null, 2)), [json]);

  const stage: "intake" | "aegis" | "pega" =
    routing || caseId ? "pega" : status === "live" || Object.keys(draft).length > 0 ? "aegis" : "intake";

  const completePct = Math.round((completeness?.score ?? 0) * 100);
  const canRoute = (completeness?.score ?? 0) >= 0.5 || status === "ended";

  return (
    <section className="flex h-full flex-col gap-4">
      {/* JSON output */}
      <div className="flex flex-1 flex-col rounded-sm border border-border/60 bg-card/40 backdrop-blur-sm shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Code2 className="h-3.5 w-3.5 text-primary" />
            Bank-Compliant JSON
          </div>
          <span className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
            ISO-20022
          </span>
        </div>
        <div className="relative flex-1 overflow-auto bg-slate-950/70 p-3 font-mono text-[11px] leading-relaxed">
          <pre
            className="whitespace-pre text-foreground/90"
            // syntax highlighter returns escaped HTML
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <div className="scan-line" />
        </div>
      </div>

      {/* Routing engine + CTA */}
      <div className="rounded-sm border border-border/60 bg-card/40 backdrop-blur-sm shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Network className="h-3.5 w-3.5 text-primary" />
            Routing Engine
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {routing ? `→ ${routing.vendor_name}` : "awaiting validation"}
          </span>
        </div>

        <div className="px-4 py-5">
          <RoutingDiagram stage={stage} />

          <button
            onClick={onValidateRoute}
            disabled={finalizing || !canRoute}
            className="group relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-sm border border-primary/60 bg-primary/15 px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-primary transition-all hover:bg-primary/25 hover:shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
            style={{ boxShadow: canRoute && !finalizing ? "var(--shadow-glow)" : undefined }}
          >
            {finalizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating…
              </>
            ) : caseId ? (
              <>
                <Send className="h-4 w-4" />
                Routed · {caseId.slice(0, 8)}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Validate &amp; Route Dispute
              </>
            )}
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>

          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>completeness</span>
            <span className={completePct >= 50 ? "text-emerald-400" : "text-amber-400"}>{completePct}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoutingDiagram({ stage }: { stage: "intake" | "aegis" | "pega" }) {
  const nodes = [
    { id: "intake", label: "INTAKE" },
    { id: "aegis", label: "AEGIS" },
    { id: "pega", label: "PEGA" },
  ] as const;
  const order = { intake: 0, aegis: 1, pega: 2 } as const;
  const activeIdx = order[stage];

  return (
    <div className="relative flex items-center justify-between">
      {nodes.map((n, i) => {
        const isActive = i <= activeIdx;
        const isCurrent = i === activeIdx;
        return (
          <div key={n.id} className="flex flex-1 items-center">
            <motion.div
              layout
              animate={{ scale: isCurrent ? [1, 1.04, 1] : 1 }}
              transition={{ duration: 1.4, repeat: isCurrent ? Infinity : 0 }}
              className={`relative flex h-12 flex-1 items-center justify-center rounded-sm border font-mono text-[11px] font-semibold tracking-[0.2em] ${
                isActive
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/60 bg-slate-950/40 text-muted-foreground"
              }`}
              style={isCurrent ? { boxShadow: "0 0 16px -4px oklch(0.84 0.14 215 / 0.7)" } : undefined}
            >
              {n.label}
              {isCurrent && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary pulse-dot" />
              )}
            </motion.div>
            {i < nodes.length - 1 && (
              <svg className="mx-1 h-6 w-10 shrink-0" viewBox="0 0 40 24">
                <line
                  x1="0"
                  y1="12"
                  x2="40"
                  y2="12"
                  stroke="oklch(0.84 0.14 215 / 0.5)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  className={i < activeIdx ? "dash-flow" : undefined}
                />
                <polygon points="34,8 40,12 34,16" fill="oklch(0.84 0.14 215 / 0.6)" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
