// PII redaction utilities. Keep server + client safe.

const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g;

export function redact(input: string): string {
  if (!input) return input;
  return input
    .replace(CARD_RE, (m) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 13) return m;
      return `****-****-****-${digits.slice(-4)}`;
    })
    .replace(EMAIL_RE, (m) => {
      const [u, d] = m.split("@");
      return `${u[0] ?? "*"}***@${d}`;
    })
    .replace(PHONE_RE, (m) => {
      const digits = m.replace(/\D/g, "");
      return `***-***-${digits.slice(-4)}`;
    });
}

export function redactObject<T>(obj: T): T {
  if (obj == null) return obj;
  if (typeof obj === "string") return redact(obj) as T;
  if (Array.isArray(obj)) return obj.map((v) => redactObject(v)) as unknown as T;
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = redactObject(v);
    }
    return out as T;
  }
  return obj;
}
