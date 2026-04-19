import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseDraft, ClassifyResult, CompletenessResult, RouteResult } from "@/lib/aegis/types";

const REASON_LABEL: Record<string, string> = {
  unauthorized: "Unauthorized charge",
  product_not_received: "Product not received",
  product_not_as_described: "Not as described",
  duplicate_charge: "Duplicate charge",
  cancelled_recurring: "Cancelled recurring",
  credit_not_processed: "Credit not processed",
  other: "Other",
};

const FIELDS: Array<{ key: keyof CaseDraft; label: string; format?: (v: unknown) => string }> = [
  { key: "customer_name", label: "Customer" },
  { key: "network", label: "Network" },
  {
    key: "amount_cents",
    label: "Amount",
    format: (v) =>
      typeof v === "number" ? `$${(v / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : String(v),
  },
  { key: "merchant", label: "Merchant" },
  { key: "transaction_date", label: "Date" },
  { key: "last4", label: "Card last 4", format: (v) => `••••${String(v)}` },
  { key: "customer_contact_masked", label: "Contact" },
  { key: "description", label: "Details" },
];

interface Props {
  draft: CaseDraft;
  classification: ClassifyResult | null;
  completeness: CompletenessResult | null;
  routing: RouteResult | null;
  caseId: string | null;
}

export function LiveCaseCard({ draft, classification, completeness, routing, caseId }: Props) {
  return (
    <Card className="overflow-hidden border bg-card/60 p-0 backdrop-blur-sm shadow-[var(--shadow-card)]">
      <div className="border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Live case
          </div>
          {caseId ? (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {caseId.slice(0, 8)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">draft</Badge>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {FIELDS.map((f) => {
            const v = draft[f.key];
            const has = v !== undefined && v !== null && v !== "";
            return (
              <div
                key={String(f.key)}
                className={cn("space-y-0.5", has && "field-in")}
                data-key={String(f.key)}
              >
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    has ? "text-foreground" : "text-muted-foreground/50",
                  )}
                >
                  {has ? (f.format ? f.format(v) : String(v)) : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <Section title="Classification">
          {classification ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/50 p-3 field-in">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {REASON_LABEL[classification.dispute_reason] ?? classification.dispute_reason}
                </span>
              </div>
              <Badge variant="secondary">
                {Math.round(classification.confidence * 100)}% confidence
              </Badge>
            </div>
          ) : (
            <Placeholder>Awaiting classification…</Placeholder>
          )}
        </Section>

        <Section title="Completeness">
          {completeness ? (
            <div className="space-y-2 field-in">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {completeness.missing_fields.length === 0
                    ? "All required fields captured"
                    : `Missing: ${completeness.missing_fields.join(", ")}`}
                </span>
                <span className="font-mono text-xs">
                  {Math.round(completeness.score * 100)}%
                </span>
              </div>
              <Progress value={completeness.score * 100} className="h-2" />
            </div>
          ) : (
            <Placeholder>Will compute on finalize.</Placeholder>
          )}
        </Section>

        <Section title="Routing decision">
          {routing ? (
            <div className="space-y-3 field-in">
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-primary">
                    Routed to
                  </div>
                  <div className="text-base font-semibold">{routing.vendor_name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    vendor {routing.vendor_id} · rule {routing.rule_id}
                    {routing.reason_code ? ` · code ${routing.reason_code}` : ""}
                  </div>
                </div>
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              {routing.scored_alternatives.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Alternatives
                  </div>
                  {routing.scored_alternatives.map((a) => (
                    <div
                      key={a.vendor_id}
                      className="flex items-center justify-between rounded-lg border bg-background/40 px-3 py-1.5 text-xs"
                    >
                      <span>
                        <span className="font-mono text-muted-foreground">{a.vendor_id}</span>{" "}
                        {a.vendor_name}
                      </span>
                      <span className="font-mono text-muted-foreground">score {a.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Placeholder>Will route on finalize.</Placeholder>
          )}
        </Section>
      </div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed bg-background/30 p-3 text-sm text-muted-foreground">
      <CircleDashed className="h-4 w-4" />
      {children}
    </div>
  );
}
