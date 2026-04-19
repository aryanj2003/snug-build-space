// Simulated "card on file" lookup. In a real bank, the caller is already
// authenticated to their account before reaching dispute intake, so the bank
// system already knows the card details. We never collect them from the caller.
//
// This module derives last4 / network / customer_name from the transaction
// fingerprint (merchant + amount + date) using a deterministic mock.

import type { CaseDraft, NetworkType } from "./types";

export interface CardOnFile {
  customer_name: string;
  network: NetworkType;
  last4: string;
  customer_contact_masked: string;
  // Where this came from, for the demo's "Resolved from account" panel
  source: "account_lookup";
}

// Deterministic hash so the same merchant+amount+date always resolves to the
// same fake card — makes the demo feel real.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const NETWORKS: NetworkType[] = ["VISA", "MC", "AMEX", "DISCOVER"];
const NAMES = [
  "Sarah Chen",
  "Marcus Webb",
  "Priya Patel",
  "Jordan Reyes",
  "Alex Morgan",
];

export function resolveCardOnFile(draft: CaseDraft): CardOnFile | null {
  // Need at least one fingerprint field to fake a lookup.
  const seed = [draft.merchant ?? "", draft.amount_cents ?? "", draft.transaction_date ?? ""]
    .join("|");
  if (seed === "||") return null;

  const h = hash(seed);
  const network = NETWORKS[h % NETWORKS.length];
  const last4 = String(1000 + (h % 9000));
  const name = NAMES[(h >> 3) % NAMES.length];
  const phoneTail = String(1000 + ((h >> 7) % 9000));

  return {
    customer_name: name,
    network,
    last4,
    customer_contact_masked: `***-***-${phoneTail}`,
    source: "account_lookup",
  };
}
