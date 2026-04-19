import { useState } from "react";
import { ChevronDown, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { verifyChain } from "@/lib/aegis/commit";

export interface AuditRow {
  seq: number;
  event_type: string;
  payload: Record<string, unknown>;
  hash: string;
  prev_hash: string | null;
  created_at: string;
}

interface Props {
  caseId: string | null;
  events: AuditRow[];
}

export function AuditTrail({ caseId, events }: Props) {
  const [open, setOpen] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<null | { valid: boolean; checked: number; brokenAt?: number }>(
    null,
  );

  async function onVerify() {
    if (!caseId) return;
    setVerifying(true);
    try {
      const r = await verifyChain(caseId);
      setResult(r);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-[var(--shadow-card)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Audit trail
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {events.length} events
          </Badge>
          {result && (
            <Badge
              variant={result.valid ? "secondary" : "destructive"}
              className="gap-1 text-[10px]"
            >
              {result.valid ? (
                <>
                  <ShieldCheck className="h-3 w-3" /> chain valid ({result.checked})
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3 w-3" /> broken at #{result.brokenAt}
                </>
              )}
            </Badge>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-muted-foreground">
              SHA-256 chain over canonical event JSON.
            </span>
            <Button size="sm" variant="outline" disabled={!caseId || verifying} onClick={onVerify}>
              {verifying ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Verifying
                </>
              ) : (
                "Verify chain"
              )}
            </Button>
          </div>
          {events.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-muted-foreground">
              No audit events yet. Finalize an intake to populate the chain.
            </div>
          ) : (
            <div className="max-h-[260px] overflow-y-auto border-t">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                  <tr className="text-muted-foreground">
                    <th className="px-5 py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Event</th>
                    <th className="py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Prev</th>
                    <th className="px-5 py-2 font-medium">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.seq} className="border-t border-border/50">
                      <td className="px-5 py-2 font-mono">{e.seq}</td>
                      <td className="py-2">{e.event_type}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(e.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 font-mono text-muted-foreground">
                        {e.prev_hash ? `${e.prev_hash.slice(0, 8)}…` : "—"}
                      </td>
                      <td className="px-5 py-2 font-mono">{e.hash.slice(0, 12)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
