import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Activity } from "lucide-react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { toast } from "sonner";

import { ensureAnonymousSession } from "@/lib/aegis/auth";
import { supabase } from "@/integrations/supabase/client";
import { classifyTranscript } from "@/server/classify.functions";
import { getElevenLabsToken, getElevenLabsSignedUrl } from "@/server/elevenlabs.functions";
import { scoreCompleteness } from "@/lib/aegis/completeness";
import { route as runRoute } from "@/lib/aegis/router";
import { commitCase } from "@/lib/aegis/commit";
import { SARAH_DEMO } from "@/lib/aegis/simulatedCall";

import { CallControl } from "@/components/aegis/CallControl";
import { Transcript, type TranscriptLine } from "@/components/aegis/Transcript";
import { LiveCaseCard } from "@/components/aegis/LiveCaseCard";
import { AuditTrail, type AuditRow } from "@/components/aegis/AuditTrail";

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
      { title: "Aegis Intake — Voice-first dispute filing" },
      {
        name: "description",
        content:
          "Turn a customer call into a structured, classified, routed dispute case in under 60 seconds.",
      },
    ],
  }),
});

function IntakeRoute() {
  return (
    <ConversationProvider>
      <IntakePage />
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
  const [voiceToken, setVoiceToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const fieldEventsRef = useRef<FieldEvent[]>([]);
  const draftRef = useRef<CaseDraft>({});
  const transcriptTextRef = useRef<string>("");
  const finalizingRef = useRef<boolean>(false);

  // Anonymous sign-in on load + prefetch voice token
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
    }
  }, [captureField]);

  const conversation = useConversation({
    clientTools: {
      capture_field: (params: { field: string; value: unknown }) => {
        const field = String(params?.field ?? "").trim();
        if (!CAPTURE_FIELD_SET.has(field)) {
          console.warn("capture_field: unknown field", field);
          return "unknown_field";
        }
        const result = coerceFieldValue(field as CaptureField, params?.value);
        if (!result.ok) {
          console.warn("capture_field: invalid value", field, params?.value, result.reason);
          return `invalid:${result.reason}`;
        }
        captureField({ [field]: result.value } as Partial<CaseDraft>);
        return "ok";
      },
      mark_dispute_reason: (params: { reason: string; confidence?: number }) => {
        const reason = String(params?.reason ?? "").trim().toLowerCase();
        if (!DISPUTE_REASON_SET.has(reason)) {
          console.warn("mark_dispute_reason: unknown reason", reason);
          return "unknown_reason";
        }
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
        void finalize();
        return "finalizing";
      },
    },
    onConnect: () => {
      setStatus("live");
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

  const startVoice = useCallback(async () => {
    if (!hasCredentials || !agentId) {
      toast.error("Voice not configured", {
        description: "Missing a valid agent ID.",
      });
      return;
    }

    resetSession();
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      // Use WebSocket transport — ElevenLabs' WebRTC endpoint is currently
      // returning 404 on /rtc/v1/validate for this SDK version. WS is reliable.
      const signed = await getElevenLabsSignedUrl();
      if (!signed.signedUrl) {
        throw new Error(signed.error ?? "Could not get a signed conversation URL");
      }
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
    cancelSim();
  };

  const runSimulation = useCallback(() => {
    resetSession();
    setStatus("live");
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

  useEffect(() => {
    if (status === "live") setCompleteness(scoreCompleteness(draft));
  }, [draft, status]);

  return (
    <div className="min-h-screen text-foreground">
      <Toaster richColors theme="dark" position="top-right" />
      <header className="border-b border-border/50 bg-background/30 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Aegis</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Voice-first dispute intake
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            {authReady ? "Demo session active" : "Starting demo session…"}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <section className="space-y-6 lg:col-span-3">
            <div className="rounded-2xl border bg-card/60 p-2 backdrop-blur-sm shadow-[var(--shadow-card)]">
              <CallControl
                status={status}
                isAgentSpeaking={conversation.isSpeaking}
                hasCredentials={hasCredentials}
                onStart={startVoice}
                onStop={stopVoice}
                onSimulate={runSimulation}
              />
            </div>
            <Transcript lines={transcript} />
          </section>

          <section className="lg:col-span-2">
            <LiveCaseCard
              draft={draft}
              classification={classification}
              completeness={completeness}
              routing={routing}
              caseId={caseId}
            />
          </section>
        </div>

        <AuditTrail caseId={caseId} events={audit} />
      </main>
    </div>
  );
}

// Help TS narrow the value of NetworkType in dev tools
export type _ = NetworkType;
