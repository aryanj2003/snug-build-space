import type { CaseDraft, ClassifyResult, RouteResult } from "@/lib/aegis/types";
import type { TranscriptLine } from "./Transcript";

interface Props {
  draft: CaseDraft;
  classification: ClassifyResult | null;
  routing: RouteResult | null;
  transcript: TranscriptLine[];
  onStart: () => void;
  onFinalize: () => void;
}

/**
 * Windows-95 reskin reading the same state. Intentionally crude: missing
 * fields, MISCLASSIFIED badges, no animations. Sells the before/after demo.
 */
export function LegacyShell({ draft, classification, routing, transcript, onStart, onFinalize }: Props) {
  return (
    <div className="legacy-mode min-h-screen p-4">
      <div className="mx-auto max-w-[1100px] space-y-3">
        <LegacyWindow title="DisputeIntake.exe — [DISPUTES_INTAKE_TERMINAL.DAT]">
          <div className="p-3 text-[12px]">
            <div className="mb-2">File &nbsp; Edit &nbsp; View &nbsp; Tools &nbsp; Help</div>
            <hr className="mb-2 border-t-2 border-t-[#808080]" />
            <div className="flex gap-2">
              <button className="legacy-button" onClick={onStart}>
                Start Call
              </button>
              <button className="legacy-button" onClick={onFinalize}>
                OK
              </button>
              <button className="legacy-button" disabled>
                Cancel
              </button>
            </div>
          </div>
        </LegacyWindow>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LegacyWindow title="Call Transcript.txt">
            <div className="bg-white p-2 font-mono text-[11px] text-black" style={{ minHeight: 220, maxHeight: 280, overflow: "auto" }}>
              {transcript.length === 0 ? (
                <div className="text-[#666]">[no transcript]</div>
              ) : (
                transcript.map((l) => (
                  <div key={l.id}>
                    &gt; {l.speaker === "agent" ? "OPER" : "CUST"}: {l.text}
                  </div>
                ))
              )}
            </div>
          </LegacyWindow>

          <LegacyWindow title="Form_DisputeRecord.frm">
            <div className="space-y-2 p-3 text-[12px]">
              <LegacyField label="Customer" value={draft.customer_name ?? "<MISSING>"} missing={!draft.customer_name} />
              <LegacyField label="Network" value={draft.network ?? "<MISSING>"} missing={!draft.network} />
              <LegacyField
                label="Amount"
                value={draft.amount_cents != null ? `$${(draft.amount_cents / 100).toFixed(2)}` : "<MISSING>"}
                missing={draft.amount_cents == null}
              />
              <LegacyField label="Merchant" value={draft.merchant ?? "<MISSING>"} missing={!draft.merchant} />
              <LegacyField label="Date" value={draft.transaction_date ?? "<MISSING>"} missing={!draft.transaction_date} />
              <LegacyField label="Card ****" value={draft.last4 ?? "<MISSING>"} missing={!draft.last4} />

              <hr className="my-2 border-t-2 border-t-[#808080]" />

              <div className="flex items-center justify-between">
                <span>Classification:</span>
                <span className="legacy-error">[MISCLASSIFIED]</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Reason Code:</span>
                <span className="legacy-error">[ERR_NO_MATCH]</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Routed To:</span>
                <span>{routing?.vendor_name ?? "<UNROUTED>"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Confidence:</span>
                <span>{classification ? `${Math.round(classification.confidence * 100)}%` : "N/A"}</span>
              </div>
            </div>
          </LegacyWindow>
        </div>

        <LegacyWindow title="System Message">
          <div className="flex items-center gap-3 p-3 text-[12px]">
            <div
              style={{
                width: 32,
                height: 32,
                background: "#ff0",
                border: "2px solid #000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
              }}
            >
              !
            </div>
            <div>
              <div className="legacy-error">ERROR: 3 fields missing. Please re-key from voicemail recording.</div>
              <div className="text-[#333]">Estimated handle time: 14 minutes 22 seconds.</div>
            </div>
          </div>
        </LegacyWindow>
      </div>
    </div>
  );
}

function LegacyWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legacy-window">
      <div className="legacy-titlebar">
        <span>{title}</span>
        <span className="flex gap-1">
          <span className="legacy-button px-1 py-0 text-[10px]">_</span>
          <span className="legacy-button px-1 py-0 text-[10px]">□</span>
          <span className="legacy-button px-1 py-0 text-[10px]">×</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function LegacyField({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: 90 }}>{label}:</span>
      <input
        readOnly
        value={value}
        className={`legacy-input flex-1 ${missing ? "legacy-error" : ""}`}
        style={{ color: missing ? "#c00" : "#000" }}
      />
    </div>
  );
}
