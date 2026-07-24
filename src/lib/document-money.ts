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

export function documentTaxAmount(subtotal: number, taxRatePercent = DOCUMENT_TAX_RATE_PERCENT): number {
  if (!(taxRatePercent > 0)) return 0;
  return roundMoney(subtotal * (taxRatePercent / 100));
}

export function documentGrandTotal(subtotal: number, taxRatePercent = DOCUMENT_TAX_RATE_PERCENT): number {
  return roundMoney(subtotal + documentTaxAmount(subtotal, taxRatePercent));
}
