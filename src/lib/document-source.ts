/** Stable ids so converting the same quote / pre-order on two devices does not mint two invoices. */

export function quotationIdFromConversionNote(note?: string | null): string | null {
  const match = String(note ?? "").match(/Converted from quotation\s+(\S+)/i);
  const id = match?.[1]?.trim();
  return id || null;
}

export function invoiceIdFromQuotationId(quoteId: string): string {
  const id = quoteId.trim();
  if (!id) return "";
  if (id.startsWith("Q-")) return `INV-${id.slice(2)}`;
  if (id.startsWith("INV-")) return id;
  return `INV-from-${id}`;
}

export function invoiceIdFromPreOrderId(preOrderId: string): string {
  const id = preOrderId.trim();
  return id ? `INV-from-${id}` : "";
}
