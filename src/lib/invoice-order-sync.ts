type InvoiceBalanceListener = (documentId: string, remaining: number) => void;

const listeners = new Set<InvoiceBalanceListener>();

export function onInvoiceBalanceChange(listener: InvoiceBalanceListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitInvoiceBalanceChange(documentId: string, remaining: number) {
  if (!documentId) return;
  for (const listener of listeners) listener(documentId, remaining);
}
