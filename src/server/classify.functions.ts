import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ClassifyInput = z.object({
  transcript: z.string().min(1).max(20000),
});

const REASONS = [
  "unauthorized",
  "product_not_received",
  "product_not_as_described",
  "duplicate_charge",
  "cancelled_recurring",
  "credit_not_processed",
  "other",
] as const;

interface ClassifyOut {
  dispute_reason: (typeof REASONS)[number];
  confidence: number;
}

export const classifyTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClassifyInput.parse(input))
  .handler(async ({ data }): Promise<ClassifyOut> => {
    // Support multiple AI providers via env vars.
    // OPENAI_API_KEY + OPENAI_BASE_URL → any OpenAI-compatible API (OpenAI, OpenRouter, local)
    // LOVABLE_API_KEY → Lovable AI Gateway (original, kept for backward compat)
    // No key → keyword-based fallback (works fine for demos)
    const openaiKey = process.env.OPENAI_API_KEY;
    const openaiBase = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const lovableKey = process.env.LOVABLE_API_KEY;

    if (!openaiKey && !lovableKey) {
      return keywordClassify(data.transcript);
    }

    const apiUrl = openaiKey
      ? `${openaiBase}/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = openaiKey ?? lovableKey!;
    const model = openaiKey ? openaiModel : "google/gemini-2.5-flash";

    const tools = [
      {
        type: "function",
        function: {
          name: "submit_classification",
          description: "Return the dispute classification.",
          parameters: {
            type: "object",
            properties: {
              dispute_reason: { type: "string", enum: REASONS },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["dispute_reason", "confidence"],
            additionalProperties: false,
          },
        },
      },
    ];

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You classify credit-card dispute call transcripts into one of the allowed dispute_reason values. Return ONLY a tool call with dispute_reason and a confidence between 0 and 1.",
            },
            { role: "user", content: data.transcript },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "submit_classification" } },
        }),
      });

      if (!res.ok) {
        console.error("classify gateway error", res.status, await res.text());
        return keywordClassify(data.transcript);
      }
      const json = await res.json();
      const call = json?.choices?.[0]?.message?.tool_calls?.[0];
      const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
      if (!args || !REASONS.includes(args.dispute_reason)) {
        return keywordClassify(data.transcript);
      }
      const confidence = typeof args.confidence === "number" ? args.confidence : 0.6;
      return { dispute_reason: args.dispute_reason, confidence };
    } catch (e) {
      console.error("classify failed", e);
      return keywordClassify(data.transcript);
    }
  });

function keywordClassify(t: string): ClassifyOut {
  const s = t.toLowerCase();
  if (/\b(didn'?t (make|authorize)|unauthorized|fraud|stolen|not me)\b/.test(s))
    return { dispute_reason: "unauthorized", confidence: 0.78 };
  if (/\b(never (received|got)|not (delivered|received)|missing package)\b/.test(s))
    return { dispute_reason: "product_not_received", confidence: 0.72 };
  if (/\b(not as described|wrong item|defective|damaged|fake)\b/.test(s))
    return { dispute_reason: "product_not_as_described", confidence: 0.7 };
  if (/\b(charged twice|double charge|duplicate)\b/.test(s))
    return { dispute_reason: "duplicate_charge", confidence: 0.75 };
  if (/\b(cancel(led|ed)? (subscription|membership)|recurring)\b/.test(s))
    return { dispute_reason: "cancelled_recurring", confidence: 0.7 };
  if (/\b(refund (never|hasn'?t)|credit not (processed|received))\b/.test(s))
    return { dispute_reason: "credit_not_processed", confidence: 0.7 };
  return { dispute_reason: "other", confidence: 0.4 };
}
