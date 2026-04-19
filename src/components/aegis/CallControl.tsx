import { Mic, MicOff, Loader2, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "idle" | "connecting" | "live" | "ended";

interface Props {
  status: Status;
  isAgentSpeaking: boolean;
  hasCredentials: boolean;
  onStart: () => void;
  onStop: () => void;
  onSimulate: () => void;
}

export function CallControl({
  status,
  isAgentSpeaking,
  hasCredentials,
  onStart,
  onStop,
  onSimulate,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10">
      <div className="relative">
        <button
          onClick={status === "live" ? onStop : onStart}
          disabled={status === "connecting" || !hasCredentials}
          aria-label={status === "live" ? "End call" : "Start call"}
          className={cn(
            "relative flex h-32 w-32 items-center justify-center rounded-full transition-all",
            "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]",
            "hover:scale-105 disabled:opacity-50 disabled:hover:scale-100",
            status === "live" && "pulse-ring",
          )}
        >
          {status === "connecting" ? (
            <Loader2 className="h-12 w-12 animate-spin" />
          ) : status === "live" ? (
            <PhoneOff className="h-12 w-12" />
          ) : (
            <Mic className="h-12 w-12" />
          )}
        </button>
      </div>

      <div className="text-center">
        <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {status === "idle" && "Ready"}
          {status === "connecting" && "Connecting…"}
          {status === "live" && (isAgentSpeaking ? "Agent speaking" : "Listening")}
          {status === "ended" && "Call ended"}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {status === "idle"
            ? hasCredentials
              ? "Tap to start intake"
              : "Voice not configured"
            : status === "live"
              ? "Live intake"
              : status === "ended"
                ? "Processing…"
                : "Please wait"}
        </div>
      </div>

      {!hasCredentials && status === "idle" && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm">
          <div className="flex items-center gap-2 text-warning">
            <MicOff className="h-4 w-4" />
            <span className="font-medium">ElevenLabs credentials required for live voice</span>
          </div>
          <Button variant="outline" size="sm" onClick={onSimulate}>
            Run a simulated call instead
          </Button>
        </div>
      )}

      {hasCredentials && status === "idle" && (
        <Button variant="ghost" size="sm" onClick={onSimulate}>
          or run a simulated call
        </Button>
      )}
    </div>
  );
}
