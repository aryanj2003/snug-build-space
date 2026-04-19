// Canonical JSON + sha256 hash chaining for audit events.

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  // Web Crypto is available in the Worker runtime + browsers.
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export interface ChainInput {
  case_id: string;
  seq: number;
  event_type: string;
  payload: unknown;
  prev_hash: string | null;
  created_at: string;
}

export async function computeHash(input: ChainInput): Promise<string> {
  return sha256Hex(canonicalize(input));
}
