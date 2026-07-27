/** Money helpers — keep invoice/payment math consistent. */

/** Round to nearest cent (USD). */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Sales tax / VAT percent applied on document subtotals.
 * Set to e.g. 11 for Lebanon VAT when the business needs it; 0 = no tax line.
 */
export const DOCUMENT_TAX_RATE_PERCENT = 0;

export type DocumentDiscountType = "percent" | "amount";

export type DocumentDiscount = {
  type: DocumentDiscountType;
  /** Percent 0–100, or fixed USD amount. */
  value: number;
};

export function documentTaxAmount(subtotal: number, taxRatePercent = DOCUMENT_TAX_RATE_PERCENT): number {
  if (!(taxRatePercent > 0)) return 0;
  return roundMoney(subtotal * (taxRatePercent / 100));
}

/** Discount taken off the line-items subtotal (never exceeds subtotal). */
export function documentDiscountAmount(
  subtotal: number,
  discount?: DocumentDiscount | null,
): number {
  if (!discount || !(subtotal > 0) || !(discount.value > 0)) return 0;
  if (discount.type === "percent") {
    const pct = Math.min(100, discount.value);
    return roundMoney(subtotal * (pct / 100));
  }
  return roundMoney(Math.min(subtotal, discount.value));
}

export function documentNetSubtotal(
  subtotal: number,
  discount?: DocumentDiscount | null,
): number {
  return roundMoney(Math.max(0, subtotal - documentDiscountAmount(subtotal, discount)));
}

/** Persistable discount, or undefined when none. */
export function normalizeDocumentDiscount(
  type: DocumentDiscountType,
  value: number,
): DocumentDiscount | undefined {
  if (!Number.isFinite(value) || !(value > 0)) return undefined;
  return {
    type,
    value: type === "percent" ? Math.min(100, value) : value,
  };
}

/**
 * Grand total after optional discount, then tax on the discounted net.
 * Call as `documentGrandTotal(subtotal)` or `documentGrandTotal(subtotal, discount)`.
 */
export function documentGrandTotal(
  subtotal: number,
  discount?: DocumentDiscount | null,
  taxRatePercent = DOCUMENT_TAX_RATE_PERCENT,
): number {
  const net = documentNetSubtotal(subtotal, discount);
  return roundMoney(net + documentTaxAmount(net, taxRatePercent));
}
