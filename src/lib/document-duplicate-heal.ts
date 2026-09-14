/** Collapse invoices that are the same quotation / pre-order saved under two codes. */

import { preOrderIdFromInvoiceNote } from "./preorders";
import { quotationIdFromConversionNote } from "./document-source";

export const MERGED_DUPLICATE_RECEIPT_NOTE = "Duplicate receipt from merged invoice";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function moneyOf(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function receiptDate(r: Record<string, unknown>): string {
  if (typeof r.paymentDate === "string" && r.paymentDate) return r.paymentDate;
  if (typeof r.date === "string" && r.date) return r.date;
  if (typeof r.createdAt === "string" && r.createdAt.length >= 10) return r.createdAt.slice(0, 10);
  return "";
}

function receiptAffects(r: Record<string, unknown>): boolean {
  if (r.kind !== "receipt") return false;
  if (typeof r.affectsBalance === "boolean") return r.affectsBalance;
  return r.internalNote !== "Receipt created for already-paid invoice";
}

/** Receipt written as the first payment on a full invoice (remaining ≈ total − this receipt). */
function looksLikeFirstPayment(receipt: Record<string, unknown>, invoiceTotal: number): boolean {
  const rem = Number(receipt.invoiceRemainingAfter);
  if (!Number.isFinite(rem)) return false;
  const expected = Math.round((invoiceTotal - moneyOf(receipt.total)) * 100) / 100;
  return Math.abs(rem - expected) < 0.05;
}

function similarPaymentAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 1.01;
}

function markDuplicateReceipt(item: Record<string, unknown>): Record<string, unknown> {
  const note =
    typeof item.internalNote === "string" && item.internalNote.trim()
      ? item.internalNote
      : MERGED_DUPLICATE_RECEIPT_NOTE;
  return { ...item, affectsBalance: false, internalNote: note };
}

function sourceKey(inv: Record<string, unknown>): string | null {
  const note = typeof inv.internalNote === "string" ? inv.internalNote : "";
  const quoteId = quotationIdFromConversionNote(note);
  if (quoteId) return `quote:${quoteId}`;
  const preOrderId = preOrderIdFromInvoiceNote(note);
  if (preOrderId) return `preorder:${preOrderId}`;
  return null;
}

function paidOf(inv: Record<string, unknown>): number {
  const n = Number(inv.amountPaid);
  return Number.isFinite(n) ? n : 0;
}

function pickWinner(group: Record<string, unknown>[]): Record<string, unknown> {
  return [...group].sort((a, b) => {
    const stock = Number(Boolean(a.stockDeducted)) - Number(Boolean(b.stockDeducted));
    if (stock !== 0) return stock > 0 ? -1 : 1;
    const paid = paidOf(b) - paidOf(a);
    if (Math.abs(paid) > 0.005) return paid > 0 ? 1 : -1;
    return String(a.id).localeCompare(String(b.id));
  })[0]!;
}

function healDocArray(docs: unknown[]): unknown[] {
  const invoices = docs.filter(
    (item): item is Record<string, unknown> =>
      isPlainObject(item) && item.kind === "invoice" && typeof item.id === "string",
  );
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const inv of invoices) {
    const key = sourceKey(inv);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(inv);
    groups.set(key, list);
  }

  const loserToWinner = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const winner = pickWinner(group);
    const winnerId = String(winner.id);
    for (const inv of group) {
      const id = String(inv.id);
      if (id !== winnerId) loserToWinner.set(id, winnerId);
    }
  }
  if (loserToWinner.size === 0) return docs;

  const winnerHasSimilarReceipt = (winnerId: string, incoming: Record<string, unknown>) => {
    const incomingTotal = moneyOf(incoming.total);
    const incomingDate = receiptDate(incoming);
    return docs.some((item) => {
      if (!isPlainObject(item) || item.kind !== "receipt") return false;
      if (item.invoiceId !== winnerId || !receiptAffects(item)) return false;
      if (incomingDate && receiptDate(item) !== incomingDate) return false;
      return similarPaymentAmount(moneyOf(item.total), incomingTotal);
    });
  };

  return docs
    .filter((item) => {
      if (!isPlainObject(item) || item.kind !== "invoice") return true;
      return !loserToWinner.has(String(item.id));
    })
    .map((item) => {
      if (!isPlainObject(item)) return item;
      if ((item.kind === "receipt" || item.kind === "credit_note") && typeof item.invoiceId === "string") {
        const winnerId = loserToWinner.get(item.invoiceId);
        if (!winnerId) return item;
        const moved = { ...item, invoiceId: winnerId };
        if (
          item.kind === "receipt" &&
          receiptAffects(item) &&
          winnerHasSimilarReceipt(winnerId, item)
        ) {
          return markDuplicateReceipt(moved);
        }
        return moved;
      }
      return item;
    });
}

/**
 * After two invoice codes were collapsed, both "first $500 of $985" receipts
 * can sit on the same bill. Only one of those is real cash.
 */
function unstackFirstPaymentReceipts(docs: unknown[]): unknown[] {
  const invoices = new Map<string, Record<string, unknown>>();
  for (const item of docs) {
    if (!isPlainObject(item) || item.kind !== "invoice" || typeof item.id !== "string") continue;
    invoices.set(item.id, item);
  }

  const neutralize = new Set<string>();
  const byInvoice = new Map<string, Record<string, unknown>[]>();
  for (const item of docs) {
    if (!isPlainObject(item) || item.kind !== "receipt" || typeof item.id !== "string") continue;
    if (typeof item.invoiceId !== "string" || !receiptAffects(item)) continue;
    const inv = invoices.get(item.invoiceId);
    if (!inv) continue;
    if (!looksLikeFirstPayment(item, moneyOf(inv.total))) continue;
    const list = byInvoice.get(item.invoiceId) ?? [];
    list.push(item);
    byInvoice.set(item.invoiceId, list);
  }

  for (const recs of byInvoice.values()) {
    if (recs.length < 2) continue;
    const used = new Set<string>();
    for (let i = 0; i < recs.length; i += 1) {
      const a = recs[i]!;
      const aId = String(a.id);
      if (used.has(aId)) continue;
      const cluster = [a];
      used.add(aId);
      for (let j = i + 1; j < recs.length; j += 1) {
        const b = recs[j]!;
        const bId = String(b.id);
        if (used.has(bId)) continue;
        if (receiptDate(a) !== receiptDate(b)) continue;
        if (!similarPaymentAmount(moneyOf(a.total), moneyOf(b.total))) continue;
        cluster.push(b);
        used.add(bId);
      }
      if (cluster.length < 2) continue;
      cluster.sort((x, y) => {
        const ta = String(x.createdAt ?? "");
        const tb = String(y.createdAt ?? "");
        if (ta !== tb) return ta.localeCompare(tb);
        return moneyOf(y.total) - moneyOf(x.total);
      });
      for (const extra of cluster.slice(1)) neutralize.add(String(extra.id));
    }
  }

  if (neutralize.size === 0) return docs;
  return docs.map((item) => {
    if (!isPlainObject(item) || typeof item.id !== "string" || !neutralize.has(item.id)) return item;
    return markDuplicateReceipt(item);
  });
}

export function healDuplicateConvertedDocuments(value: unknown): unknown {
  if (Array.isArray(value)) return unstackFirstPaymentReceipts(healDocArray(value));
  if (isPlainObject(value) && Array.isArray(value.documents)) {
    return {
      ...value,
      documents: unstackFirstPaymentReceipts(healDocArray(value.documents)),
    };
  }
  return value;
}
