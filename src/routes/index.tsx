import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { toast } from "sonner";

import { ensureAnonymousSession } from "@/lib/aegis/auth";
import { publicSupabase as supabase } from "@/lib/aegis/publicSupabase";
import { classifyTranscript } from "@/server/classify.functions";
import { getElevenLabsToken, getElevenLabsSignedUrl } from "@/server/elevenlabs.functions";
import { scoreCompleteness } from "@/lib/aegis/completeness";
import { route as runRoute } from "@/lib/aegis/router";
import { commitCase } from "@/lib/aegis/commit";
import { SARAH_DEMO } from "@/lib/aegis/simulatedCall";
import { resolveCardOnFile } from "@/lib/aegis/cardOnFile";

import { AegisHeader } from "@/components/aegis/Header";
import { CallStream } from "@/components/aegis/CallStream";
import { EnforcementLedger } from "@/components/aegis/EnforcementLedger";
import { SystemOutput } from "@/components/aegis/SystemOutput";
import { LegacyShell } from "@/components/aegis/LegacyShell";
import { TraceProvider } from "@/components/aegis/TraceContext";
import { AuditTrail, type AuditRow } from "@/components/aegis/AuditTrail";
import type { TranscriptLine } from "@/components/aegis/Transcript";
import { Button } from "@/components/ui/button";
import { Mic, PhoneOff, Loader2, Play } from "lucide-react";

import type {
  CaseDraft,
  ClassifyResult,
  CompletenessResult,
  RouteResult,
  DisputeReason,
  NetworkType,
} from "@/lib/aegis/types";
import {
  CAPTURE_FIELDS,
  DISPUTE_REASONS,
  NETWORK_TYPES,
  type CaptureField,
} from "@/lib/aegis/types";
import { Toaster } from "@/components/ui/sonner";

const CAPTURE_FIELD_SET = new Set<string>(CAPTURE_FIELDS);
const DISPUTE_REASON_SET = new Set<string>(DISPUTE_REASONS);
const NETWORK_SET = new Set<string>(NETWORK_TYPES);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerceFieldValue(
  field: CaptureField,
  value: unknown,
):
  | { ok: true; value: string | number }
  | { ok: false; reason: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: false, reason: "empty_value" };
  }
  switch (field) {
    case "amount_cents": {
      const raw = String(value);
      const n = typeof value === "number" ? value : Number(raw.replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(n)) return { ok: false, reason: "not_a_number" };
      const cents = raw.includes(".") ? Math.round(n * 100) : Math.round(n);
      if (cents < 0) return { ok: false, reason: "negative" };
      return { ok: true, value: cents };
    }
    case "network": {
      const up = String(value).toUpperCase().trim();
      const map: Record<string, NetworkType> = {
        VISA: "VISA",
        MC: "MC",
        MASTERCARD: "MC",
        "MASTER CARD": "MC",
        AMEX: "AMEX",
        "AMERICAN EXPRESS": "AMEX",
        DISCOVER: "DISCOVER",
      };
      const v = map[up] ?? (NETWORK_SET.has(up) ? (up as NetworkType) : "OTHER");
      return { ok: true, value: v };
    }
    case "currency": {
      const up = String(value).toUpperCase().trim().slice(0, 3);
      if (!/^[A-Z]{3}$/.test(up)) return { ok: false, reason: "bad_currency" };
      return { ok: true, value: up };
    }
    case "transaction_date": {
      const s = String(value).trim();
      if (ISO_DATE.test(s)) return { ok: true, value: s };
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return { ok: false, reason: "bad_date" };
      return { ok: true, value: d.toISOString().slice(0, 10) };
    }
    case "last4": {
      const digits = String(value).replace(/\D/g, "").slice(-4);
      if (digits.length !== 4) return { ok: false, reason: "bad_last4" };
      return { ok: true, value: digits };
    }
    default:
      return { ok: true, value: String(value).trim() };
  }
}

export const Route = createFileRoute("/")({
  component: IntakeRoute,
  head: () => ({
    meta: [
      { title: "Aegis Voice — Intake Enforcement Console" },
      {
        name: "description",
        content:
          "Voice-first dispute intake with deterministic protocol enforcement, ISO-20022 output, and an immutable audit ledger.",
      },
    ],
  }),
});

function IntakeRoute() {
  return (
    <ConversationProvider>
      <TraceProvider>
        <IntakePage />
      </TraceProvider>
    </ConversationProvider>
  );
}

type Status = "idle" | "connecting" | "live" | "ended";

interface FieldEvent {
  field: string;
  value: unknown;
  at: string;
}

function IntakePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [draft, setDraft] = useState<CaseDraft>({});
  const [classification, setClassification] = useState<ClassifyResult | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);
  const [routing, setRouting] = useState<RouteResult | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [, setVoiceToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const fieldEventsRef = useRef<FieldEvent[]>([]);
  const draftRef = useRef<CaseDraft>({});
  const transcriptTextRef = useRef<string>("");
  const finalizingRef = useRef<boolean>(false);
  const endSessionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAnonymousSession();
        if (!cancelled) setAuthReady(true);
      } catch (e) {
        console.error("Anonymous sign-in failed", e);
        toast.error("Could not start a demo session", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
      try {
        const tok = await getElevenLabsToken();
        if (!cancelled) {
          setHasCredentials(Boolean(tok.token && tok.agentId));
          setAgentId(tok.agentId ?? null);
          setVoiceToken(tok.token ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setHasCredentials(false);
          setVoiceToken(null);
          console.error("ElevenLabs token prefetch failed", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const captureField = useCallback((updates: Partial<CaseDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...updates };
      draftRef.current = next;
      return next;
    });
    const at = new Date().toISOString();
    for (const [k, v] of Object.entries(updates)) {
      fieldEventsRef.current.push({ field: k, value: v, at });
    }
  }, []);

  const appendTranscript = useCallback((speaker: "agent" | "user", text: string) => {
    const line: TranscriptLine = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      speaker,
      text,
      ts: new Date().toISOString(),
    };
    setTranscript((prev) => [...prev, line]);
    transcriptTextRef.current += `${speaker === "agent" ? "Agent" : "User"}: ${text}\n`;
  }, []);

  const finalize = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setStatus("ended");
    try {
      const transcriptText = transcriptTextRef.current.trim() || "No transcript captured.";

      let classify: ClassifyResult;
      if (draftRef.current.dispute_reason) {
        classify = {
          dispute_reason: draftRef.current.dispute_reason,
          confidence: draftRef.current.classification_confidence ?? 0.9,
        };
      } else {
        classify = await classifyTranscript({ data: { transcript: transcriptText } });
      }
      setClassification(classify);
      captureField({ dispute_reason: classify.dispute_reason });

      // Minimal-PII: resolve card details from "card on file" instead of asking caller.
      const cof = resolveCardOnFile({ ...draftRef.current, dispute_reason: classify.dispute_reason });
      if (cof) {
        const resolved: Partial<CaseDraft> = {};
        if (!draftRef.current.network) resolved.network = cof.network;
        if (!draftRef.current.last4) resolved.last4 = cof.last4;
        if (!draftRef.current.customer_name) resolved.customer_name = cof.customer_name;
        if (!draftRef.current.customer_contact_masked) resolved.customer_contact_masked = cof.customer_contact_masked;
        if (Object.keys(resolved).length > 0) captureField(resolved);
      }

      const comp = scoreCompleteness({ ...draftRef.current, dispute_reason: classify.dispute_reason });
      setCompleteness(comp);

      const [vRes, rRes] = await Promise.all([
        supabase.from("vendor_registry").select("*").eq("active", true),
        supabase.from("routing_rules").select("*").eq("active", true),
      ]);
      if (vRes.error) throw vRes.error;
      if (rRes.error) throw rRes.error;
      const decision = runRoute(
        { ...draftRef.current, dispute_reason: classify.dispute_reason },
        rRes.data as never,
        vRes.data as never,
      );
      setRouting(decision);

      const commit = await commitCase({
        draft: { ...draftRef.current, dispute_reason: classify.dispute_reason },
        classification: { dispute_reason: classify.dispute_reason, confidence: classify.confidence },
        completeness: comp,
        routing: decision,
        transcript: transcriptText,
        fieldEvents: fieldEventsRef.current,
      });
      setCaseId(commit.case_id);

      const { data: events } = await supabase
        .from("audit_events")
        .select("seq,event_type,payload,prev_hash,hash,created_at")
        .eq("case_id", commit.case_id)
        .order("seq", { ascending: true });
      if (events) setAudit(events as AuditRow[]);

      toast.success(`Case routed to ${decision.vendor_name}`, {
        description: decision.reason_code ? `Reason code ${decision.reason_code}` : undefined,
      });
    } catch (e) {
      console.error("finalize failed", e);
      toast.error("Failed to finalize case", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setFinalizing(false);
    }
  }, [captureField]);

  // Task 1.1 / 1.3: Memoize clientTools so useConversation receives a stable
  // reference across re-renders. Dependencies are captureField and finalize,
  // both already wrapped in useCallback with stable deps.
  const clientTools = useMemo(
    () => ({
      capture_field: (params: { field: string; value: unknown }) => {
        const field = String(params?.field ?? "").trim();
        if (!CAPTURE_FIELD_SET.has(field)) return "unknown_field";
        const result = coerceFieldValue(field as CaptureField, params?.value);
        if (!result.ok) return `invalid:${result.reason}`;
        captureField({ [field]: result.value } as Partial<CaseDraft>);
        return "ok";
      },
      mark_dispute_reason: (params: { reason: string; confidence?: number }) => {
        const reason = String(params?.reason ?? "").trim().toLowerCase();
        if (!DISPUTE_REASON_SET.has(reason)) return "unknown_reason";
        const rawConf = typeof params?.confidence === "number" ? params.confidence : 0.85;
        const confidence = Math.max(0, Math.min(1, rawConf));
        captureField({
          dispute_reason: reason as DisputeReason,
          classification_confidence: confidence,
        });
        return "ok";
      },
      finalize_intake: () => {
        if (finalizingRef.current) return "already_finalizing";
        // Terminate voice session if live
        if (endSessionRef.current) {
          try { endSessionRef.current(); } catch (_) { /* ignore */ }
        }
        void finalize();
        return "finalizing";
      },
    }),
    [captureField, finalize],
  );

  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      setStatus("live");
      setStartedAt(Date.now());
    },
    onMessage: (m: { source?: string; message?: string; type?: string }) => {
      if (m && typeof m.message === "string") {
        const speaker: "agent" | "user" = m.source === "user" ? "user" : "agent";
        appendTranscript(speaker, m.message);
      }
    },
    onError: (message, err) => {
      console.error("convai error", message, err);
      toast.error("Voice connection error", {
        description: typeof message === "string" ? message : err instanceof Error ? err.message : "Session failed to start",
      });
      setStatus("idle");
    },
    onDisconnect: () => {
      setStatus((s) => (s === "live" ? "ended" : s));
    },
  });

  // Keep endSessionRef in sync so finalize_intake can terminate the voice stream
  endSessionRef.current = conversation.endSession;

  const startVoice = useCallback(async () => {
    if (!hasCredentials || !agentId) {
      toast.error("Voice not configured", { description: "Missing a valid agent ID." });
      return;
    }
    resetSession();
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const signed = await getElevenLabsSignedUrl();
      if (!signed.signedUrl) throw new Error(signed.error ?? "Could not get a signed conversation URL");
      setVoiceToken(signed.signedUrl);
      conversation.startSession({
        signedUrl: signed.signedUrl,
        connectionType: "websocket",
      });
    } catch (e) {
      console.error("start voice failed", e);
      toast.error("Could not start voice", {
        description: e instanceof Error ? e.message : String(e),
      });
      setStatus("idle");
    }
  }, [agentId, conversation, hasCredentials]);

  const stopVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } finally {
      void finalize();
    }
  }, [conversation, finalize]);

  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSim = () => {
    if (simTimerRef.current) clearTimeout(simTimerRef.current);
    simTimerRef.current = null;
  };

  const resetSession = () => {
    setTranscript([]);
    setDraft({});
    setClassification(null);
    setCompleteness(null);
    setRouting(null);
    setCaseId(null);
    setAudit([]);
    fieldEventsRef.current = [];
    draftRef.current = {};
    transcriptTextRef.current = "";
    finalizingRef.current = false;
    setStartedAt(null);
    cancelSim();
  };

  const runSimulation = useCallback(() => {
    resetSession();
    setStatus("live");
    setStartedAt(Date.now());
    let i = 0;
    const tick = () => {
      const step = SARAH_DEMO[i];
      if (!step) {
        void finalize();
        return;
      }
      simTimerRef.current = setTimeout(() => {
        appendTranscript(step.speaker, step.text);
        if (step.capture) captureField(step.capture);
        i += 1;
        tick();
      }, step.delayMs);
    };
    tick();
  }, [appendTranscript, captureField, finalize]);

  useEffect(() => () => cancelSim(), []);

  // Task 1.2: Debounce completeness scoring with 300ms delay so rapid
  // field captures don't trigger synchronous scoring on every draft change.
  useEffect(() => {
    if (status !== "live") return;
    const timer = setTimeout(() => {
      setCompleteness(scoreCompleteness(draft));
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, status]);

  return (
    <>
      <Toaster richColors theme="dark" position="top-right" />
      <AnimatePresence mode="wait">
        {legacy ? (
          <motion.div
            key="legacy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="fixed top-3 right-3 z-50">
              <button
                onClick={() => setLegacy(false)}
                className="rounded-md border border-primary/40 bg-slate-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10"
              >
                ← Back to Aegis
              </button>
            </div>
            <LegacyShell
              draft={draft}
              classification={classification}
              routing={routing}
              transcript={transcript}
              onStart={hasCredentials ? startVoice : runSimulation}
              onFinalize={() => void finalize()}
            />
          </motion.div>
        ) : (
          <motion.div
            key="aegis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="min-h-screen text-foreground"
          >
            <AegisHeader legacy={legacy} onToggleLegacy={setLegacy} />

            <main className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
              {/* Mini status / call control bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border/60 bg-card/40 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="text-primary">SESSION</span>
                  <span>·</span>
                  <span>{authReady ? "AUTH OK" : "AUTH PENDING"}</span>
                  <span>·</span>
                  <span>{hasCredentials ? "VOICE READY" : "VOICE OFFLINE"}</span>
                  <span>·</span>
                  <span className={status === "live" ? "text-emerald-400" : ""}>
                    STATUS: {status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runSimulation}
                    disabled={status === "live" || status === "connecting"}
                    className="gap-1.5 font-mono text-[11px] uppercase tracking-wider"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Simulate
                  </Button>
                  {status === "live" ? (
                    <Button
                      size="sm"
                      onClick={stopVoice}
                      className="gap-1.5 bg-destructive text-destructive-foreground font-mono text-[11px] uppercase tracking-wider hover:bg-destructive/90"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      End Call
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={startVoice}
                      disabled={!hasCredentials || status === "connecting"}
                      className="gap-1.5 bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wider hover:bg-primary/90"
                    >
                      {status === "connecting" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                      Start Intake
                    </Button>
                  )}
                </div>
              </div>

              {/* Main 3-column console */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <CallStream status={status} lines={transcript} draft={draft} />
                </div>
                <div className="lg:col-span-4">
                  <EnforcementLedger
                    draft={draft}
                    classification={classification}
                    completeness={completeness}
                    transcript={transcript}
                    startedAt={startedAt}
                  />
                </div>
                <div className="lg:col-span-4">
                  <SystemOutput
                    draft={draft}
                    classification={classification}
                    routing={routing}
                    caseId={caseId}
                    completeness={completeness}
                    status={status}
                    onValidateRoute={() => void finalize()}
                    finalizing={finalizing}
                  />
                </div>
              </div>

              <AuditTrail caseId={caseId} events={audit} />
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// keep type referenced
export type _ = NetworkType;
