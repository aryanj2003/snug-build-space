import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface TranscriptLine {
  id: string;
  speaker: "agent" | "user";
  text: string;
  ts: string;
}

export function Transcript({ lines }: { lines: TranscriptLine[] }) {
  return (
    <div className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-[var(--shadow-card)]">
      <div className="border-b px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Live transcript
      </div>
      <ScrollArea className="h-[280px] px-5 py-4">
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Transcript will appear here once the call starts.
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "flex gap-3 text-sm field-in",
                  l.speaker === "agent" ? "" : "flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase",
                    l.speaker === "agent"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {l.speaker === "agent" ? "AI" : "U"}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 leading-snug",
                    l.speaker === "agent" ? "bg-secondary" : "bg-primary/15",
                  )}
                >
                  {l.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
