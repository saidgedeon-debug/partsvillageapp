/** Recompute invoice amountPaid from affecting receipts after multi-device merge. */

import { healDuplicateConvertedDocuments } from "./document-duplicate-heal";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function receiptAffectsBalance(receipt: Record<string, unknown>): boolean {
  if (receipt.kind !== "receipt") return false;
  if (typeof receipt.affectsBalance === "boolean") return receipt.affectsBalance;
  return receipt.internalNote !== "Receipt created for already-paid invoice";
}

function sumAffectingPaid(invoiceId: string, docs: Record<string, unknown>[]): number {
  let sum = 0;
  for (const d of docs) {
    if (d.kind !== "receipt" || d.invoiceId !== invoiceId) continue;
    if (!receiptAffectsBalance(d)) continue;
    const t = Number(d.total);
    if (Number.isFinite(t)) sum += t;
  }
  return Math.max(0, Math.round(sum * 100) / 100);
}

function resolveStatus(
  inv: Record<string, unknown>,
  paid: number,
  credits: number,
): string {
  const total = Number(inv.total);
  const t = Number.isFinite(total) ? total : 0;
  const covered = paid + credits;
  if (covered >= t - 0.005) return "Paid";
  if (paid > 0.005 || credits > 0.005) return "Partial";
  const prev = typeof inv.status === "string" ? inv.status : "Unpaid";
  if (prev === "Overdue") return "Overdue";
  return "Unpaid";
}

function creditsFor(invoiceId: string, docs: Record<string, unknown>[]): number {
  let sum = 0;
  for (const d of docs) {
    if (d.kind !== "credit_note" || d.invoiceId !== invoiceId) continue;
    const t = Number(d.total);
    if (Number.isFinite(t)) sum += t;
  }
  return Math.max(0, Math.round(sum * 100) / 100);
}

/** Heal amountPaid on invoices inside a documents shop_state blob or raw array. */
export function healDocumentsAmountPaid(value: unknown): unknown {
  const deduped = healDuplicateConvertedDocuments(value);
  if (Array.isArray(deduped)) {
    return healDocArray(deduped);
  }
  if (isPlainObject(deduped) && Array.isArray(deduped.documents)) {
    return { ...deduped, documents: healDocArray(deduped.documents) };
  }
  return deduped;
}

function healDocArray(docs: unknown[]): unknown[] {
  const records = docs.filter(isPlainObject) as Record<string, unknown>[];
  return docs.map((item) => {
    if (!isPlainObject(item) || item.kind !== "invoice") return item;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) return item;
    const hasReceipts = records.some(
      (d) => d.kind === "receipt" && d.invoiceId === id && receiptAffectsBalance(d),
    );
    const fromReceipts = sumAffectingPaid(id, records);
    let paperPaid = 0;
    for (const d of records) {
      if (d.kind !== "receipt" || d.invoiceId !== id) continue;
      if (receiptAffectsBalance(d)) continue;
      const n = Number(d.total);
      if (Number.isFinite(n)) paperPaid += n;
    }
    paperPaid = Math.max(0, Math.round(paperPaid * 100) / 100);
    const prevPaid =
      typeof item.amountPaid === "number" && Number.isFinite(item.amountPaid)
        ? Math.max(0, item.amountPaid)
        : null;
    const total = Number(item.total);
    const t = Number.isFinite(total) ? total : 0;
    // Never wipe a legacy paid invoice that has no receipt rows.
    // If amountPaid was lost but a paperwork receipt exists, that receipt is the payment.
    const paid = hasReceipts
      ? fromReceipts
      : prevPaid != null && prevPaid > 0.005
        ? prevPaid
        : item.status === "Paid"
          ? t
          : paperPaid > 0.005
            ? paperPaid
            : (prevPaid ?? 0);
    const credits = creditsFor(id, records);
    const status = resolveStatus(item, paid, credits);
    if (prevPaid === paid && item.status === status) return item;
    return { ...item, amountPaid: paid, status };
  });
}
