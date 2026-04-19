import type { CaseDraft, ClassifyResult, RouteResult } from "./types";

/**
 * Build an ISO-20022-shaped CustomerPaymentReversalRequest (camt.087-ish, simplified).
 * This is a demo schema — keys map to the spirit of the standard, not the wire format.
 */
export function buildIso20022(opts: {
  draft: CaseDraft;
  classification: ClassifyResult | null;
  routing: RouteResult | null;
  caseId: string | null;
}): Record<string, unknown> {
  const { draft, classification, routing, caseId } = opts;
  const ts = new Date().toISOString();

  return {
    Document: {
      CstmrPmtRvslReq: {
        Assgnmt: {
          Id: caseId ?? "PENDING",
          Assgnr: { Pty: { Nm: "AEGIS_VOICE_INTAKE" } },
          Assgne: { Agt: { FinInstnId: { Nm: routing?.vendor_name ?? "PEGA_BANK_DISPUTES" } } },
          CreDtTm: ts,
        },
        Case: {
          Id: caseId ?? "DRAFT",
          Cretr: { Pty: { Nm: draft.customer_name ?? "<unknown>" } },
          ReasonCd: routing?.reason_code ?? null,
        },
        Undrlyg: {
          TxInf: {
            OrgnlTxRef: {
              Amt: {
                value: draft.amount_cents != null ? draft.amount_cents / 100 : null,
                Ccy: draft.currency ?? "USD",
              },
              CardTx: {
                Ntwk: draft.network ?? null,
                PAN: draft.last4 ? `************${draft.last4}` : null,
                MrchntNm: draft.merchant ?? null,
                TxDt: draft.transaction_date ?? null,
              },
            },
            RvslRsnInf: {
              Cd: classification?.dispute_reason ?? draft.dispute_reason ?? null,
              Conf: classification?.confidence ?? draft.classification_confidence ?? null,
              AddtlInf: draft.description ?? null,
            },
          },
        },
        SplmtryData: {
          Envlp: {
            AegisIntake: {
              Channel: "VOICE",
              Protocol: "DETERMINISTIC",
              CustomerCtct: draft.customer_contact_masked ?? null,
              CapturedAt: ts,
            },
          },
        },
      },
    },
  };
}

/** Tiny syntax-highlight for our JSON viewer (keys cyan, strings emerald, numbers amber). */
export function syntaxHighlightJson(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "text-amber-400"; // numbers
        if (/^"/.test(match)) {
          if (/:$/.test(match)) cls = "text-cyan-400"; // keys
          else cls = "text-emerald-400"; // strings
        } else if (/true|false/.test(match)) {
          cls = "text-cyan-300";
        } else if (/null/.test(match)) {
          cls = "text-slate-500";
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
}
