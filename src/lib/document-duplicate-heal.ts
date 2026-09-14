/** Collapse invoices that are the same quotation / pre-order saved under two codes. */

import { preOrderIdFromInvoiceNote } from "./preorders";
import { quotationIdFromConversionNote } from "./document-source";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
        return { ...item, invoiceId: winnerId };
      }
      return item;
    });
}

export function healDuplicateConvertedDocuments(value: unknown): unknown {
  if (Array.isArray(value)) return healDocArray(value);
  if (isPlainObject(value) && Array.isArray(value.documents)) {
    return { ...value, documents: healDocArray(value.documents) };
  }
  return value;
}
