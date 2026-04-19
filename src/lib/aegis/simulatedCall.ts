// Pre-canned simulated call (Sarah / VISA / $847 unauthorized) for demos when
// ElevenLabs credentials are not configured.

import type { CaseDraft } from "@/lib/aegis/types";

export interface SimStep {
  delayMs: number;
  speaker: "agent" | "user";
  text: string;
  capture?: Partial<CaseDraft>;
}

export const SARAH_DEMO: SimStep[] = [
  { delayMs: 600, speaker: "agent", text: "Aegis intake — what's going on with your account?" },
  {
    delayMs: 2200,
    speaker: "user",
    text: "Hi, this is Sarah Chen. There's a charge on my Visa I didn't make.",
    capture: { customer_name: "Sarah Chen", network: "VISA" },
  },
  { delayMs: 1400, speaker: "agent", text: "I'm sorry to hear that. How much was the charge?" },
  {
    delayMs: 1500,
    speaker: "user",
    text: "Eight hundred forty-seven dollars.",
    capture: { amount_cents: 84700, currency: "USD" },
  },
  { delayMs: 1300, speaker: "agent", text: "And what was the merchant name on the statement?" },
  {
    delayMs: 1500,
    speaker: "user",
    text: "It says Lumen Goods. I've never bought from them.",
    capture: { merchant: "Lumen Goods" },
  },
  { delayMs: 1200, speaker: "agent", text: "Got it. What date did the charge post?" },
  {
    delayMs: 1300,
    speaker: "user",
    text: "April 14th of this year.",
    capture: { transaction_date: "2026-04-14" },
  },
  { delayMs: 1100, speaker: "agent", text: "And the last four digits of your card?" },
  { delayMs: 1100, speaker: "user", text: "Four-nine-two-eight.", capture: { last4: "4928" } },
  { delayMs: 1200, speaker: "agent", text: "What's the best phone number to reach you?" },
  {
    delayMs: 1300,
    speaker: "user",
    text: "415-555-0142.",
    capture: { customer_contact_masked: "***-***-0142" },
  },
  {
    delayMs: 1300,
    speaker: "agent",
    text: "Thank you Sarah. To confirm — you did not authorize this $847 charge from Lumen Goods on April 14th?",
  },
  {
    delayMs: 1500,
    speaker: "user",
    text: "Correct, I never authorized it. I want to dispute it as fraud.",
    capture: {
      description: "Customer reports unauthorized charge; never purchased from this merchant.",
    },
  },
  { delayMs: 1200, speaker: "agent", text: "Filing your dispute now. One moment." },
];
