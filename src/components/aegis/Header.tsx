import { ShieldCheck, Database, Cpu } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Props {
  legacy: boolean;
  onToggleLegacy: (v: boolean) => void;
}

export function AegisHeader({ legacy, onToggleLegacy }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/40">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="font-mono text-[13px] font-semibold tracking-[0.18em] text-foreground">
            AEGIS <span className="text-primary">//</span> INTAKE ENFORCEMENT
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-primary pulse-dot" />
              <span className="absolute inset-0 rounded-full bg-primary blur-[3px] opacity-70" />
            </span>
            PROTOCOL: <span className="text-primary">DETERMINISTIC</span>
          </div>

          <div className="hidden items-center gap-2 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400 md:flex">
            <Database className="h-3 w-3" />
            AUDIT LEDGER: ACTIVE
          </div>

          <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            Legacy Mode
            <Switch checked={legacy} onCheckedChange={onToggleLegacy} />
          </label>
        </div>
      </div>
    </header>
  );
}
