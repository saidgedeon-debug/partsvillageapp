/** Invoice due = total − affecting receipts − linked credits. */

export type BalanceDoc = {
  id: string;
  kind: string;
  total: number;
  status?: string;
  amountPaid?: number;
  invoiceId?: string;
  internalNote?: string | null;
  affectsBalance?: boolean;
};

export function receiptAffectsBalance(receipt: BalanceDoc): boolean {
  if (receipt.kind !== "receipt") return false;
  if (typeof receipt.affectsBalance === "boolean") return receipt.affectsBalance;
  return receipt.internalNote !== "Receipt created for already-paid invoice";
}

function sumReceipts(
  invoiceId: string,
  documents: BalanceDoc[],
  affecting: boolean,
): number {
  const sum = documents
    .filter((d) => {
      if (d.kind !== "receipt" || d.invoiceId !== invoiceId) return false;
      return affecting ? receiptAffectsBalance(d) : !receiptAffectsBalance(d);
    })
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  return Math.max(0, Math.round(sum * 100) / 100);
}

export function affectingReceiptsPaid(invoiceId: string, documents: BalanceDoc[] = []): number {
  return sumReceipts(invoiceId, documents, true);
}

export function invoiceCredits(inv: BalanceDoc, creditNotes: BalanceDoc[] = []): number {
  if (inv.kind !== "invoice") return 0;
  const sum = creditNotes
    .filter((d) => d.kind === "credit_note" && d.invoiceId === inv.id)
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  return Math.max(0, Math.round(sum * 100) / 100);
}

/**
 * Cash collected on an invoice.
 * Receipts are the ledger when any affecting receipt exists.
 * Otherwise keep stored amountPaid (legacy invoices paid without a receipt row).
 */
export function invoiceAmountPaid(inv: BalanceDoc, documents: BalanceDoc[] = []): number {
  if (inv.kind !== "invoice") return 0;
  const stored =
    typeof inv.amountPaid === "number" && Number.isFinite(inv.amountPaid)
      ? Math.max(0, inv.amountPaid)
      : null;
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  if (documents.length > 0) {
    const hasAffecting = documents.some(
      (d) => d.kind === "receipt" && d.invoiceId === inv.id && receiptAffectsBalance(d),
    );
    if (hasAffecting) return affectingReceiptsPaid(inv.id, documents);
  }
  if (stored != null && stored > 0.005) return stored;
  if (inv.status === "Paid") return total;
  if (documents.length > 0) {
    const paperPaid = sumReceipts(inv.id, documents, false);
    if (paperPaid > 0.005) return paperPaid;
  }
  return stored ?? 0;
}

export function invoiceRemaining(
  inv: BalanceDoc,
  creditNotes: BalanceDoc[] = [],
  documents: BalanceDoc[] = [],
): number {
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  const paid = invoiceAmountPaid(inv, documents);
  const credits = invoiceCredits(inv, creditNotes);
  return Math.max(0, Math.round((total - paid - credits) * 100) / 100);
}

export function invoiceRefundOwed(
  inv: BalanceDoc,
  creditNotes: BalanceDoc[] = [],
  documents: BalanceDoc[] = [],
): number {
  if (inv.kind !== "invoice") return 0;
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  const paid = invoiceAmountPaid(inv, documents);
  const credits = invoiceCredits(inv, creditNotes);
  return Math.max(0, Math.round((paid + credits - total) * 100) / 100);
}
