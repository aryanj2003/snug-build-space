// Pre-canned simulated call (minimal-PII version) for demos when ElevenLabs
// credentials are not configured. The caller never speaks card digits, full
// name, network, or phone — only the transaction fingerprint. last4/network/
// name/contact are resolved from the simulated "card on file" at finalize time.

import type { CaseDraft } from "@/lib/aegis/types";

export interface SimStep {
  delayMs: number;
  speaker: "agent" | "user";
  text: string;
  capture?: Partial<CaseDraft>;
}

export const SARAH_DEMO: SimStep[] = [
  {
    delayMs: 600,
    speaker: "agent",
    text: "Aegis intake — I can see your account. Which charge are you disputing?",
  },
  {
    delayMs: 2200,
    speaker: "user",
    text: "There's an eight hundred forty-seven dollar charge from Lumen Goods I didn't make.",
    capture: { amount_cents: 84700, currency: "USD", merchant: "Lumen Goods" },
  },
  { delayMs: 1200, speaker: "agent", text: "Got it. What date did that charge post?" },
  {
    delayMs: 1300,
    speaker: "user",
    text: "April 14th of this year.",
    capture: { transaction_date: "2026-04-14" },
  },
  {
    delayMs: 1100,
    speaker: "agent",
    text: "Roughly what time of day — morning, afternoon, or evening?",
  },
  {
    delayMs: 1100,
    speaker: "user",
    text: "Late evening, I think.",
    capture: { approx_time_of_day: "evening" },
  },
  {
    delayMs: 1300,
    speaker: "agent",
    text: "Thanks. Can you tell me what happened — why are you disputing it?",
  },
  {
    delayMs: 1500,
    speaker: "user",
    text: "I never authorized it. I've never even bought from Lumen Goods. It's fraud.",
    capture: {
      description: "Customer reports unauthorized charge; never purchased from this merchant.",
    },
  },
  {
    delayMs: 1300,
    speaker: "agent",
    text: "Confirming — eight hundred forty-seven dollars at Lumen Goods on April 14th, evening, unauthorized. Filing now.",
  },
];
