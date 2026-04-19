import { useEffect, useMemo, useRef } from "react";
import { Radio } from "lucide-react";
import { Waveform } from "./Waveform";
import type { TranscriptLine } from "./Transcript";
import type { CaseDraft } from "@/lib/aegis/types";
import { highlight, tracePatternsForDraft } from "@/lib/aegis/highlight";
import { useTrace } from "./TraceContext";

interface Props {
  status: "idle" | "connecting" | "live" | "ended";
  lines: TranscriptLine[];
  draft: CaseDraft;
}

export function CallStream({ status, lines, draft }: Props) {
  const { hovered } = useTrace();
  const scrollRef = useRef<HTMLDivElement>(null);
  const traceTerms = useMemo(() => tracePatternsForDraft(draft), [draft]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const isLive = status === "live";

  return (
    <section className="flex h-full flex-col rounded-sm border border-border/60 bg-card/40 backdrop-blur-sm shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" />
          Live Call Stream
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isLive ? "bg-emerald-500 pulse-dot" : status === "connecting" ? "bg-amber-500" : "bg-muted-foreground/50"
            }`}
          />
          <span className={isLive ? "text-emerald-400" : "text-muted-foreground"}>
            {isLive ? "ON-AIR" : status === "connecting" ? "LINK" : status === "ended" ? "CLOSED" : "STANDBY"}
          </span>
        </div>
      </div>

      <div className="p-3">
        <Waveform active={isLive} />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-4 font-mono text-[12.5px] leading-relaxed"
        style={{ minHeight: 240, maxHeight: 380 }}
      >
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground/70">
            // Transcript stream idle — awaiting connection.
          </div>
        ) : (
          <div className="space-y-2.5">
            {lines.map((l) => {
              const isAgent = l.speaker === "agent";
              const ts = formatTs(l.ts);
              return (
                <div key={l.id} className="grid grid-cols-[58px_56px_1fr] gap-3 field-in">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    [{ts}]
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
                      isAgent ? "text-primary" : "text-emerald-400"
                    }`}
                  >
                    {isAgent ? "AGENT" : "CALLER"}
                  </span>
                  <span className="text-foreground/90">
                    {highlight(l.text, hovered, traceTerms)}
                  </span>
                </div>
              );
            })}
            {isLive && (
              <div className="caret-blink font-mono text-[12px] text-muted-foreground/60">
                &nbsp;
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${m}:${s}`;
}
