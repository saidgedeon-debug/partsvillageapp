import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { CartLine, DocumentKind, PartyKind } from "@/components/app/cart-context";
import { generateDocId, type PaymentMethod } from "@/lib/document-export";
import { invoiceDiscountRatio, roundMoney } from "@/lib/document-money";
import { useCloudState } from "@/lib/cloud-store";
import { currency } from "@/lib/mock-data";

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Rejected";
export type InvoiceStatus = "Paid" | "Partial" | "Unpaid" | "Overdue";
export type InquiryStatus = "Open" | "Answered" | "Closed";
export type ReceiptStatus = "Paid";
export type CreditNoteStatus = "Paid";

export type { PaymentMethod };

export type SavedDocument = {
  id: string;
  kind: DocumentKind;
  partyKind: PartyKind;
  partyId?: string;
  partyName: string;
  date: string;
  createdAt: string;
  total: number;
  status: QuoteStatus | InvoiceStatus | InquiryStatus | ReceiptStatus | CreditNoteStatus;
  includeCost?: boolean;
  lines: CartLine[];
  stockDeducted?: boolean;
  /** Credit note: inventory was restocked for returned lines. */
  stockRestocked?: boolean;
  /** Credit note: part ids that actually went back to stock (missing catalog parts omitted). */
  restockedPartIds?: string[];
  /** Document-level discount type (percent of subtotal, or fixed USD). */
  discountType?: "percent" | "amount";
  /** Document-level discount value (percent 0–100, or USD amount). */
  discountValue?: number;
  /** Private staff note — never printed on the PDF. */
  internalNote?: string;
  /** Cumulative amount collected on an invoice. */
  amountPaid?: number;
  /** Receipt / credit note → linked invoice id. */
  invoiceId?: string;
  /** Receipt payment channel. */
  paymentMethod?: PaymentMethod;
  /** Receipt payment date (YYYY-MM-DD). */
  paymentDate?: string;
  /** Mobile number for OMT / Whish payments. */
  paymentMobile?: string;
  /**
   * Receipt: whether this payment increased invoice `amountPaid`.
   * False for record-only receipts on already-paid invoices.
   * Undefined on legacy receipts — inferred from the staff note.
   */
  affectsBalance?: boolean;
  /** Receipt snapshot of linked invoice total at issue time. */
  invoiceTotal?: number;
  /** Receipt snapshot of invoice amountPaid immediately after this payment. */
  amountPaidAfter?: number;
};

export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  mobile?: string;
  note?: string;
};

export type UpdatePaymentInput = {
  receiptId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  mobile?: string;
  note?: string;
};

export type RecordReturnInput = {
  invoiceId: string;
  lines: CartLine[];
  /** When true, caller already restocked (or should restock) — stored on the credit note. */
  restock: boolean;
  /** Part ids that were actually restocked (subset of lines). */
  restockedPartIds?: string[];
  date?: string;
  note?: string;
};

export type RecordClientDiscountInput = {
  clientId: string;
  clientName: string;
  /** USD amount to deduct from open AR (oldest invoices first). */
  amount: number;
  date?: string;
  note?: string;
};

/** Whether a receipt changed (or should change) the linked invoice balance. */
export function receiptAffectsBalance(receipt: SavedDocument): boolean {
  if (receipt.kind !== "receipt") return false;
  if (typeof receipt.affectsBalance === "boolean") return receipt.affectsBalance;
  return receipt.internalNote !== "Receipt created for already-paid invoice";
}

export function invoiceAmountPaid(inv: SavedDocument): number {
  if (inv.kind !== "invoice") return 0;
  if (typeof inv.amountPaid === "number" && Number.isFinite(inv.amountPaid)) {
    return Math.max(0, inv.amountPaid);
  }
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  return inv.status === "Paid" ? total : 0;
}

/** Sum of receipts that actually moved this invoice's balance. */
export function affectingReceiptsPaid(
  invoiceId: string,
  documents: SavedDocument[] = [],
): number {
  const sum = documents
    .filter(
      (d) =>
        d.kind === "receipt" && d.invoiceId === invoiceId && receiptAffectsBalance(d),
    )
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  return Math.max(0, Math.round(sum * 100) / 100);
}

export function deleteReceiptConfirmMessage(receipt: SavedDocument): string {
  const head = `Delete receipt ${receipt.id} (${currency(receipt.total)})?`;
  if (!receipt.invoiceId || !receiptAffectsBalance(receipt)) {
    return `${head}\n\nThis only removes the paperwork. The invoice balance will not change.`;
  }
  return `${head}\n\nThis removes the payment and puts the amount back on the invoice balance.`;
}

/** Prefer the receipt's snapshot; fall back to today's invoice figures for old receipts. */
export function receiptWithBalanceSnapshot(
  receipt: SavedDocument,
  invoices: SavedDocument[],
): SavedDocument {
  if (receipt.kind !== "receipt" || !receipt.invoiceId) return receipt;
  if (
    typeof receipt.invoiceTotal === "number" &&
    typeof receipt.amountPaidAfter === "number"
  ) {
    return receipt;
  }
  const inv = invoices.find((i) => i.id === receipt.invoiceId);
  if (!inv) return receipt;
  return {
    ...receipt,
    invoiceTotal: inv.total,
    amountPaidAfter: invoiceAmountPaid(inv),
  };
}

/** Sum of credit notes linked to an invoice. */
export function invoiceCredits(
  inv: SavedDocument,
  creditNotes: SavedDocument[] = [],
): number {
  if (inv.kind !== "invoice") return 0;
  const sum = creditNotes
    .filter((d) => d.kind === "credit_note" && d.invoiceId === inv.id)
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  return Math.max(0, Math.round(sum * 100) / 100);
}

export function invoiceRemaining(
  inv: SavedDocument,
  creditNotes: SavedDocument[] = [],
): number {
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  const paid = invoiceAmountPaid(inv);
  const credits = invoiceCredits(inv, creditNotes);
  return Math.max(0, Math.round((total - paid - credits) * 100) / 100);
}

/** Qty still returnable for a part on an invoice. */
export function returnableQty(
  invoice: SavedDocument,
  partId: string,
  creditNotes: SavedDocument[] = [],
): number {
  if (invoice.kind !== "invoice") return 0;
  const sold = invoice.lines
    .filter((l) => l.partId === partId)
    .reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0), 0);
  const returned = creditNotes
    .filter((d) => d.kind === "credit_note" && d.invoiceId === invoice.id)
    .flatMap((d) => d.lines)
    .filter((l) => l.partId === partId)
    .reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0), 0);
  return Math.max(0, Math.floor(sold - returned));
}

export function invoiceHasReturnableLines(
  invoice: SavedDocument,
  creditNotes: SavedDocument[] = [],
): boolean {
  if (invoice.kind !== "invoice") return false;
  return invoice.lines.some((l) => returnableQty(invoice, l.partId, creditNotes) > 0);
}

export function resolveInvoiceStatus(
  inv: SavedDocument,
  paid: number,
  preferred?: InvoiceStatus,
  credits = 0,
): InvoiceStatus {
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  const remaining = Math.max(0, total - paid - credits);
  if (remaining <= 0.005) return "Paid";
  if (paid > 0.005 || credits > 0.005) return "Partial";
  if (preferred === "Overdue") return "Overdue";
  return "Unpaid";
}

type DocumentsContextValue = {
  documents: SavedDocument[];
  quotations: SavedDocument[];
  invoices: SavedDocument[];
  receipts: SavedDocument[];
  creditNotes: SavedDocument[];
  inquiries: SavedDocument[];
  addDocument: (doc: SavedDocument) => void;
  updateDocument: (doc: SavedDocument) => void;
  updateDocumentStatus: (id: string, status: SavedDocument["status"]) => void;
  removeDocument: (id: string) => void;
  recordInvoicePayment: (input: RecordPaymentInput) => SavedDocument;
  updateInvoicePayment: (input: UpdatePaymentInput) => SavedDocument;
  /** Delete a receipt and reverse its effect on the linked invoice balance when needed. */
  deleteInvoicePayment: (receiptId: string) => void;
  recordInvoiceReturn: (input: RecordReturnInput) => SavedDocument;
  /** Apply a goodwill / account discount across open invoices (oldest first). */
  recordClientDiscount: (input: RecordClientDiscountInput) => SavedDocument[];
  /** Create an invoice and optionally a linked receipt in one write (avoids stale state). */
  addInvoiceWithOptionalReceipt: (
    invoice: SavedDocument,
    payment?: Omit<RecordPaymentInput, "invoiceId">,
  ) => { invoice: SavedDocument; receipt?: SavedDocument };
};

const STORAGE_KEY = "parts-village-documents-v1";

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

async function syncDocumentToSupabase(_doc: SavedDocument) {
  // shop_state JSON is the source of truth. Relational tables are unused by the app.
}

function isDocumentsEmpty(v: SavedDocument[]): boolean {
  return (v?.length ?? 0) === 0;
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const { value: documents, setValue: setDocuments } = useCloudState<SavedDocument[]>(
    "documents",
    STORAGE_KEY,
    [],
    isDocumentsEmpty,
  );

  const addDocument = useCallback(
    (doc: SavedDocument) => {
      setDocuments((prev) => [doc, ...(Array.isArray(prev) ? prev : []).filter((d) => d.id !== doc.id)]);
      void syncDocumentToSupabase(doc);
    },
    [setDocuments],
  );

  const updateDocument = useCallback(
    (doc: SavedDocument) => {
      setDocuments((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const next = list.map((d) => (d.id === doc.id ? doc : d));
        void syncDocumentToSupabase(doc);
        return next;
      });
    },
    [setDocuments],
  );

  const updateDocumentStatus = useCallback(
    (id: string, status: SavedDocument["status"]) => {
      setDocuments((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const next = list.map((d) => {
          if (d.id !== id) return d;
          if (d.kind === "invoice") {
            const invStatus = status as InvoiceStatus;
            const amountPaid = invoiceAmountPaid(d);
            const credits = invoiceCredits(
              d,
              list.filter((x) => x.kind === "credit_note"),
            );
            const resolved = resolveInvoiceStatus(d, amountPaid, invStatus, credits);
            return {
              ...d,
              status:
                invStatus === "Overdue" && amountPaid + credits < d.total
                  ? "Overdue"
                  : resolved,
              amountPaid,
            };
          }
          return { ...d, status };
        });
        const updated = next.find((d) => d.id === id);
        if (updated) void syncDocumentToSupabase(updated);
        return next;
      });
    },
    [setDocuments],
  );

  const removeDocument = useCallback(
    (id: string) => {
      setDocuments((prev) => (Array.isArray(prev) ? prev : []).filter((d) => d.id !== id));
    },
    [setDocuments],
  );

  const recordInvoicePayment = useCallback(
    (input: RecordPaymentInput): SavedDocument => {
      const amount = Math.round(input.amount * 100) / 100;
      if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
      if (input.method !== "Cash" && !input.mobile?.trim()) {
        throw new Error("Mobile number is required for OMT and Whish");
      }
      if (!input.paymentDate.trim()) throw new Error("Payment date is required");

      const now = new Date();
      const receiptId = generateDocId("receipt", now);
      const mobileBit =
        input.method !== "Cash" && input.mobile?.trim() ? ` · ${input.mobile.trim()}` : "";

      let created: SavedDocument | null = null;
      let failure: Error | null = null;

      setDocuments((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        const invoice = cur.find((d) => d.id === input.invoiceId && d.kind === "invoice");
        if (!invoice) {
          failure = new Error("Invoice not found");
          return cur;
        }

        const paidBefore = invoiceAmountPaid(invoice);
        const credits = invoiceCredits(
          invoice,
          cur.filter((d) => d.kind === "credit_note"),
        );
        const remaining = Math.max(
          0,
          Math.round((invoice.total - paidBefore - credits) * 100) / 100,
        );
        const alreadyPaid = remaining <= 0.005;
        // For already-paid invoices, allow a receipt for the record (up to total paid).
        const maxAmount = alreadyPaid
          ? Math.max(paidBefore, invoice.total)
          : remaining;
        if (amount - maxAmount > 0.005) {
          failure = new Error(
            alreadyPaid
              ? `Amount exceeds invoice total (${maxAmount})`
              : `Amount exceeds remaining balance (${remaining})`,
          );
          return cur;
        }

        const paidAfter = alreadyPaid
          ? paidBefore
          : Math.round((paidBefore + amount) * 100) / 100;
        const status = alreadyPaid
          ? ((invoice.status as InvoiceStatus) === "Paid"
              ? "Paid"
              : resolveInvoiceStatus(invoice, paidAfter, undefined, credits))
          : resolveInvoiceStatus(invoice, paidAfter, undefined, credits);

        const receipt: SavedDocument = {
          id: receiptId,
          kind: "receipt",
          partyKind: "client",
          partyId: invoice.partyId,
          partyName: invoice.partyName,
          date: input.paymentDate,
          createdAt: now.toISOString(),
          total: amount,
          status: "Paid",
          invoiceId: invoice.id,
          paymentMethod: input.method,
          paymentDate: input.paymentDate,
          paymentMobile: input.method === "Cash" ? undefined : input.mobile?.trim(),
          affectsBalance: !alreadyPaid,
          invoiceTotal: invoice.total,
          amountPaidAfter: paidAfter,
          internalNote:
            input.note?.trim() ||
            (alreadyPaid ? "Receipt created for already-paid invoice" : undefined),
          lines: [
            {
              partId: `pay-${invoice.id}`,
              partNumber: invoice.id,
              name: alreadyPaid
                ? `Payment record for ${invoice.id} · ${input.method}${mobileBit}`
                : `Payment toward ${invoice.id} · ${input.method}${mobileBit}`,
              category: "Payment",
              unitPrice: amount,
              unitCost: 0,
              qty: 1,
            },
          ],
        };

        const updatedInvoice: SavedDocument = alreadyPaid
          ? invoice
          : {
              ...invoice,
              amountPaid: paidAfter,
              status,
            };

        created = receipt;
        if (!alreadyPaid) void syncDocumentToSupabase(updatedInvoice);
        return [receipt, ...cur.map((d) => (d.id === invoice.id ? updatedInvoice : d))];
      });

      if (failure) throw failure;
      if (!created) throw new Error("Failed to record payment");
      return created;
    },
    [setDocuments],
  );

  const updateInvoicePayment = useCallback(
    (input: UpdatePaymentInput): SavedDocument => {
      const amount = Math.round(input.amount * 100) / 100;
      if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
      if (input.method !== "Cash" && !input.mobile?.trim()) {
        throw new Error("Mobile number is required for OMT and Whish");
      }
      if (!input.paymentDate.trim()) throw new Error("Payment date is required");

      const mobileBit =
        input.method !== "Cash" && input.mobile?.trim() ? ` · ${input.mobile.trim()}` : "";

      let updated: SavedDocument | null = null;
      let failure: Error | null = null;

      setDocuments((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        const receipt = cur.find((d) => d.id === input.receiptId && d.kind === "receipt");
        if (!receipt) {
          failure = new Error("Receipt not found");
          return cur;
        }
        if (!receipt.invoiceId) {
          failure = new Error("Receipt is not linked to an invoice");
          return cur;
        }

        const invoice = cur.find((d) => d.id === receipt.invoiceId && d.kind === "invoice");
        if (!invoice) {
          failure = new Error("Linked invoice not found");
          return cur;
        }

        const credits = invoiceCredits(
          invoice,
          cur.filter((d) => d.kind === "credit_note"),
        );
        const affects = receiptAffectsBalance(receipt);
        const oldAmount = Math.round((Number.isFinite(receipt.total) ? receipt.total : 0) * 100) / 100;
        const paidBefore = invoiceAmountPaid(invoice);

        if (affects) {
          const remainingWithoutThis = Math.max(
            0,
            Math.round((invoice.total - (paidBefore - oldAmount) - credits) * 100) / 100,
          );
          if (amount - remainingWithoutThis > 0.005) {
            failure = new Error(
              `Amount exceeds available balance (${remainingWithoutThis})`,
            );
            return cur;
          }
        } else {
          const maxAmount = Math.max(paidBefore, invoice.total);
          if (amount - maxAmount > 0.005) {
            failure = new Error(`Amount exceeds invoice total (${maxAmount})`);
            return cur;
          }
        }

        const nextReceipt: SavedDocument = {
          ...receipt,
          date: input.paymentDate,
          total: amount,
          paymentMethod: input.method,
          paymentDate: input.paymentDate,
          paymentMobile: input.method === "Cash" ? undefined : input.mobile?.trim(),
          affectsBalance: affects,
          invoiceTotal: invoice.total,
          amountPaidAfter: affects
            ? Math.max(0, Math.round((paidBefore - oldAmount + amount) * 100) / 100)
            : paidBefore,
          internalNote: input.note?.trim() || undefined,
          lines: [
            {
              partId: `pay-${invoice.id}`,
              partNumber: invoice.id,
              name: affects
                ? `Payment toward ${invoice.id} · ${input.method}${mobileBit}`
                : `Payment record for ${invoice.id} · ${input.method}${mobileBit}`,
              category: "Payment",
              unitPrice: amount,
              unitCost: 0,
              qty: 1,
            },
          ],
        };

        updated = nextReceipt;

        if (!affects) {
          return cur.map((d) => (d.id === receipt.id ? nextReceipt : d));
        }

        const paidAfter = Math.max(
          0,
          Math.round((paidBefore - oldAmount + amount) * 100) / 100,
        );
        const status = resolveInvoiceStatus(invoice, paidAfter, undefined, credits);
        const updatedInvoice: SavedDocument = {
          ...invoice,
          amountPaid: paidAfter,
          status,
        };
        void syncDocumentToSupabase(updatedInvoice);
        return cur.map((d) => {
          if (d.id === receipt.id) return nextReceipt;
          if (d.id === invoice.id) return updatedInvoice;
          return d;
        });
      });

      if (failure) throw failure;
      if (!updated) throw new Error("Failed to update payment");
      return updated;
    },
    [setDocuments],
  );

  const deleteInvoicePayment = useCallback(
    (receiptId: string) => {
      let failure: Error | null = null;

      setDocuments((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        const receipt = cur.find((d) => d.id === receiptId && d.kind === "receipt");
        if (!receipt) {
          failure = new Error("Receipt not found");
          return cur;
        }

        const next = cur.filter((d) => d.id !== receiptId);

        if (!receipt.invoiceId || !receiptAffectsBalance(receipt)) {
          return next;
        }

        const invoice = cur.find((d) => d.id === receipt.invoiceId && d.kind === "invoice");
        if (!invoice) return next;

        const credits = invoiceCredits(
          invoice,
          cur.filter((d) => d.kind === "credit_note"),
        );
        const paidAfter = affectingReceiptsPaid(invoice.id, next);
        const status = resolveInvoiceStatus(invoice, paidAfter, undefined, credits);
        const updatedInvoice: SavedDocument = {
          ...invoice,
          amountPaid: paidAfter,
          status,
        };
        void syncDocumentToSupabase(updatedInvoice);
        return next.map((d) => (d.id === invoice.id ? updatedInvoice : d));
      });

      if (failure) throw failure;
    },
    [setDocuments],
  );

  const recordInvoiceReturn = useCallback(
    (input: RecordReturnInput): SavedDocument => {
      const returnLines = input.lines
        .map((l) => ({
          ...l,
          qty: Math.floor(Number(l.qty)),
        }))
        .filter((l) => Number.isFinite(l.qty) && l.qty > 0);

      if (returnLines.length === 0) {
        throw new Error("Select at least one line quantity to return");
      }

      const now = new Date();
      const creditId = generateDocId("credit_note", now);
      const date =
        input.date?.trim() ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      let created: SavedDocument | null = null;
      let failure: Error | null = null;

      setDocuments((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        const invoice = cur.find((d) => d.id === input.invoiceId && d.kind === "invoice");
        if (!invoice) {
          failure = new Error("Invoice not found");
          return cur;
        }

        const existingCredits = cur.filter((d) => d.kind === "credit_note");
        for (const line of returnLines) {
          const max = returnableQty(invoice, line.partId, existingCredits);
          if (line.qty > max) {
            failure = new Error(
              `Cannot return ${line.qty} of ${line.partNumber} (only ${max} returnable)`,
            );
            return cur;
          }
        }

        const ratio = invoiceDiscountRatio(invoice);
        const listTotal = roundMoney(
          returnLines.reduce((s, l) => s + l.qty * (l.unitPrice || 0), 0),
        );
        const creditTotal = roundMoney(listTotal * ratio);
        const restockedPartIds = [
          ...new Set(
            (input.restockedPartIds ?? (input.restock ? returnLines.map((l) => l.partId) : [])).filter(
              Boolean,
            ),
          ),
        ];

        const creditNote: SavedDocument = {
          id: creditId,
          kind: "credit_note",
          partyKind: "client",
          partyId: invoice.partyId,
          partyName: invoice.partyName,
          date,
          createdAt: now.toISOString(),
          total: creditTotal,
          status: "Paid",
          invoiceId: invoice.id,
          stockRestocked: restockedPartIds.length > 0,
          restockedPartIds,
          internalNote: input.note?.trim() || undefined,
          lines: returnLines,
        };

        const creditsAfter = invoiceCredits(invoice, [...existingCredits, creditNote]);
        const paid = invoiceAmountPaid(invoice);
        const nextStatus = resolveInvoiceStatus(invoice, paid, undefined, creditsAfter);
        const updatedInvoice: SavedDocument = {
          ...invoice,
          status: nextStatus,
        };

        created = creditNote;
        void syncDocumentToSupabase(updatedInvoice);
        return [
          creditNote,
          ...cur.map((d) => (d.id === invoice.id ? updatedInvoice : d)),
        ];
      });

      if (failure) throw failure;
      if (!created) throw new Error("Failed to record return");
      return created;
    },
    [setDocuments],
  );

  const recordClientDiscount = useCallback(
    (input: RecordClientDiscountInput): SavedDocument[] => {
      const amount = Math.round(Number(input.amount) * 100) / 100;
      if (!(amount > 0)) throw new Error("Discount amount must be greater than zero");

      const now = new Date();
      const date =
        input.date?.trim() ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const note = input.note?.trim() || "Account discount";

      let created: SavedDocument[] = [];
      let failure: Error | null = null;

      setDocuments((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        const creditNotes = cur.filter((d) => d.kind === "credit_note");
        const open = cur
          .filter(
            (d) =>
              d.kind === "invoice" &&
              d.partyId === input.clientId &&
              invoiceRemaining(d, creditNotes) > 0.005,
          )
          .map((invoice) => ({
            invoice,
            remaining: invoiceRemaining(invoice, creditNotes),
            ageDays: Math.max(
              0,
              Math.floor(
                (now.getTime() - new Date(`${invoice.date}T00:00:00`).getTime()) / 86_400_000,
              ),
            ),
          }))
          .sort(
            (a, b) =>
              b.ageDays - a.ageDays || a.invoice.date.localeCompare(b.invoice.date),
          );

        const openTotal = open.reduce((s, row) => s + row.remaining, 0);
        if (openTotal <= 0.005) {
          failure = new Error("No open balance to discount");
          return cur;
        }
        if (amount - openTotal > 0.005) {
          failure = new Error(
            `Discount exceeds open balance (${openTotal.toFixed(2)})`,
          );
          return cur;
        }

        let left = amount;
        const newCredits: SavedDocument[] = [];
        const invoiceUpdates = new Map<string, SavedDocument>();
        const workingCredits = [...creditNotes];

        for (const row of open) {
          if (left <= 0.005) break;
          const apply = Math.min(row.remaining, left);
          if (apply <= 0.005) continue;
          const rounded = Math.round(apply * 100) / 100;
          left = Math.round((left - rounded) * 100) / 100;

          const creditNote: SavedDocument = {
            id: generateDocId("credit_note", new Date(now.getTime() + newCredits.length)),
            kind: "credit_note",
            partyKind: "client",
            partyId: input.clientId,
            partyName: input.clientName,
            date,
            createdAt: now.toISOString(),
            total: rounded,
            status: "Paid",
            invoiceId: row.invoice.id,
            discountType: "amount",
            discountValue: rounded,
            internalNote: note,
            lines: [
              {
                partId: `discount-${row.invoice.id}`,
                partNumber: "DISCOUNT",
                name: note,
                qty: 1,
                unitPrice: rounded,
                unitCost: 0,
                category: "Discount",
              },
            ],
          };
          newCredits.push(creditNote);
          workingCredits.push(creditNote);

          const paid = invoiceAmountPaid(row.invoice);
          const creditsAfter = invoiceCredits(row.invoice, workingCredits);
          invoiceUpdates.set(row.invoice.id, {
            ...row.invoice,
            status: resolveInvoiceStatus(row.invoice, paid, undefined, creditsAfter),
          });
        }

        if (newCredits.length === 0) {
          failure = new Error("Could not apply discount");
          return cur;
        }

        created = newCredits;
        for (const inv of invoiceUpdates.values()) {
          void syncDocumentToSupabase(inv);
        }
        return [
          ...newCredits,
          ...cur.map((d) => invoiceUpdates.get(d.id) ?? d),
        ];
      });

      if (failure) throw failure;
      if (created.length === 0) throw new Error("Failed to record discount");
      return created;
    },
    [setDocuments],
  );

  const addInvoiceWithOptionalReceipt = useCallback(
    (
      invoiceInput: SavedDocument,
      payment?: Omit<RecordPaymentInput, "invoiceId">,
    ): { invoice: SavedDocument; receipt?: SavedDocument } => {
      if (invoiceInput.kind !== "invoice") {
        throw new Error("Document must be an invoice");
      }

      let resultInvoice = invoiceInput;
      let resultReceipt: SavedDocument | undefined;
      let failure: Error | null = null;

      if (payment) {
        const amount = Math.round(payment.amount * 100) / 100;
        if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
        if (payment.method !== "Cash" && !payment.mobile?.trim()) {
          throw new Error("Mobile number is required for OMT and Whish");
        }
        if (!payment.paymentDate.trim()) throw new Error("Payment date is required");
        if (amount - invoiceInput.total > 0.005) {
          throw new Error(`Amount exceeds invoice total (${invoiceInput.total})`);
        }

        const now = new Date();
        const receiptId = generateDocId("receipt", now);
        const mobileBit =
          payment.method !== "Cash" && payment.mobile?.trim()
            ? ` · ${payment.mobile.trim()}`
            : "";
        const paidAfter = amount;
        const status = resolveInvoiceStatus(invoiceInput, paidAfter);

        resultReceipt = {
          id: receiptId,
          kind: "receipt",
          partyKind: "client",
          partyId: invoiceInput.partyId,
          partyName: invoiceInput.partyName,
          date: payment.paymentDate,
          createdAt: now.toISOString(),
          total: amount,
          status: "Paid",
          invoiceId: invoiceInput.id,
          paymentMethod: payment.method,
          paymentDate: payment.paymentDate,
          paymentMobile: payment.method === "Cash" ? undefined : payment.mobile?.trim(),
          affectsBalance: true,
          invoiceTotal: invoiceInput.total,
          amountPaidAfter: paidAfter,
          internalNote: payment.note?.trim() || undefined,
          lines: [
            {
              partId: `pay-${invoiceInput.id}`,
              partNumber: invoiceInput.id,
              name: `Payment toward ${invoiceInput.id} · ${payment.method}${mobileBit}`,
              category: "Payment",
              unitPrice: amount,
              unitCost: 0,
              qty: 1,
            },
          ],
        };
        resultInvoice = {
          ...invoiceInput,
          amountPaid: paidAfter,
          status,
        };
      }

      setDocuments((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        if (cur.some((d) => d.id === resultInvoice.id)) {
          failure = new Error("Invoice id already exists");
          return cur;
        }
        const next = resultReceipt
          ? [resultReceipt, resultInvoice, ...cur]
          : [resultInvoice, ...cur];
        return next;
      });

      if (failure) throw failure;
      void syncDocumentToSupabase(resultInvoice);
      return { invoice: resultInvoice, receipt: resultReceipt };
    },
    [setDocuments],
  );

  const docs = Array.isArray(documents) ? documents : [];

  const quotations = useMemo(() => docs.filter((d) => d.kind === "quotation"), [docs]);
  const invoices = useMemo(() => docs.filter((d) => d.kind === "invoice"), [docs]);
  const receipts = useMemo(() => docs.filter((d) => d.kind === "receipt"), [docs]);
  const creditNotes = useMemo(() => docs.filter((d) => d.kind === "credit_note"), [docs]);
  const inquiries = useMemo(() => docs.filter((d) => d.kind === "inquiry"), [docs]);

  const value = useMemo(
    () => ({
      documents: docs,
      quotations,
      invoices,
      receipts,
      creditNotes,
      inquiries,
      addDocument,
      updateDocument,
      updateDocumentStatus,
      removeDocument,
      recordInvoicePayment,
      updateInvoicePayment,
      deleteInvoicePayment,
      recordInvoiceReturn,
      recordClientDiscount,
      addInvoiceWithOptionalReceipt,
    }),
    [
      docs,
      quotations,
      invoices,
      receipts,
      creditNotes,
      inquiries,
      addDocument,
      updateDocument,
      updateDocumentStatus,
      removeDocument,
      recordInvoicePayment,
      updateInvoicePayment,
      deleteInvoicePayment,
      recordInvoiceReturn,
      recordClientDiscount,
      addInvoiceWithOptionalReceipt,
    ],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}
