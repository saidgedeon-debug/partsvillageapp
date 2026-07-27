import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { CartLine, DocumentKind, PartyKind } from "@/components/app/cart-context";
import { generateDocId, type PaymentMethod } from "@/lib/document-export";
import { useCloudState } from "@/lib/cloud-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Rejected";
export type InvoiceStatus = "Paid" | "Partial" | "Unpaid" | "Overdue";
export type InquiryStatus = "Open" | "Answered" | "Closed";
export type ReceiptStatus = "Paid";

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
  status: QuoteStatus | InvoiceStatus | InquiryStatus | ReceiptStatus;
  includeCost?: boolean;
  lines: CartLine[];
  stockDeducted?: boolean;
  /** Document-level discount type (percent of subtotal, or fixed USD). */
  discountType?: "percent" | "amount";
  /** Document-level discount value (percent 0–100, or USD amount). */
  discountValue?: number;
  /** Private staff note — never printed on the PDF. */
  internalNote?: string;
  /** Cumulative amount collected on an invoice. */
  amountPaid?: number;
  /** Receipt → linked invoice id. */
  invoiceId?: string;
  /** Receipt payment channel. */
  paymentMethod?: PaymentMethod;
  /** Receipt payment date (YYYY-MM-DD). */
  paymentDate?: string;
  /** Mobile number for OMT / Whish payments. */
  paymentMobile?: string;
};

export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  mobile?: string;
  note?: string;
};

export function invoiceAmountPaid(inv: SavedDocument): number {
  if (inv.kind !== "invoice") return 0;
  if (typeof inv.amountPaid === "number" && Number.isFinite(inv.amountPaid)) {
    return Math.max(0, inv.amountPaid);
  }
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  return inv.status === "Paid" ? total : 0;
}

export function invoiceRemaining(inv: SavedDocument): number {
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  return Math.max(0, Math.round((total - invoiceAmountPaid(inv)) * 100) / 100);
}

export function resolveInvoiceStatus(
  inv: SavedDocument,
  paid: number,
  preferred?: InvoiceStatus,
): InvoiceStatus {
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  const remaining = Math.max(0, total - paid);
  if (remaining <= 0.005) return "Paid";
  if (paid > 0.005) return "Partial";
  if (preferred === "Overdue") return "Overdue";
  return "Unpaid";
}

type DocumentsContextValue = {
  documents: SavedDocument[];
  quotations: SavedDocument[];
  invoices: SavedDocument[];
  receipts: SavedDocument[];
  inquiries: SavedDocument[];
  addDocument: (doc: SavedDocument) => void;
  updateDocument: (doc: SavedDocument) => void;
  updateDocumentStatus: (id: string, status: SavedDocument["status"]) => void;
  removeDocument: (id: string) => void;
  recordInvoicePayment: (input: RecordPaymentInput) => SavedDocument;
  /** Create an invoice and optionally a linked receipt in one write (avoids stale state). */
  addInvoiceWithOptionalReceipt: (
    invoice: SavedDocument,
    payment?: Omit<RecordPaymentInput, "invoiceId">,
  ) => { invoice: SavedDocument; receipt?: SavedDocument };
};

const STORAGE_KEY = "parts-village-documents-v1";

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

async function syncDocumentToSupabase(doc: SavedDocument) {
  if (!supabase || !isSupabaseConfigured) return;
  try {
    if (doc.kind === "quotation") {
      const { error } = await supabase.from("quotations").upsert({
        id: doc.id,
        client_id: doc.partyId || doc.partyName,
        date: doc.date,
        total: doc.total,
        status: (doc.status as QuoteStatus) || "Sent",
      } as never);
      if (error) console.error("quotation sync failed", error.message);
    } else if (doc.kind === "invoice") {
      const raw = (doc.status as InvoiceStatus) || "Unpaid";
      // Relational invoices table has no Partial; shop_state JSON keeps Partial + amountPaid.
      const status = raw === "Partial" ? "Unpaid" : raw;
      const { error } = await supabase.from("invoices").upsert({
        id: doc.id,
        client_id: doc.partyId || doc.partyName,
        date: doc.date,
        total: doc.total,
        status,
      } as never);
      if (error) console.error("invoice sync failed", error.message);
    } else if (doc.kind === "inquiry") {
      const { error } = await supabase.from("supplier_inquiries").upsert({
        id: doc.id,
        supplier: doc.partyName,
        date: doc.date,
        part_numbers: doc.lines.map((l) => l.partNumber),
        status: (doc.status as InquiryStatus) || "Open",
      } as never);
      if (error) console.error("inquiry sync failed", error.message);
    }
    // receipts stay in cloud documents JSON only
  } catch (e) {
    console.error("document sync failed", e);
  }
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
            let amountPaid = invoiceAmountPaid(d);
            if (invStatus === "Paid") amountPaid = d.total;
            if (invStatus === "Unpaid" || invStatus === "Overdue") {
              // keep payment history; status can be forced overdue while partial
              if (invStatus === "Unpaid" && amountPaid > 0 && amountPaid < d.total) {
                return { ...d, status: "Partial" as InvoiceStatus, amountPaid };
              }
            }
            const resolved = resolveInvoiceStatus(d, amountPaid, invStatus);
            return {
              ...d,
              status: invStatus === "Overdue" && amountPaid < d.total ? "Overdue" : resolved,
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
        const remaining = Math.max(
          0,
          Math.round((invoice.total - paidBefore) * 100) / 100,
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
              : resolveInvoiceStatus(invoice, paidAfter))
          : resolveInvoiceStatus(invoice, paidAfter);

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
  const inquiries = useMemo(() => docs.filter((d) => d.kind === "inquiry"), [docs]);

  const value = useMemo(
    () => ({
      documents: docs,
      quotations,
      invoices,
      receipts,
      inquiries,
      addDocument,
      updateDocument,
      updateDocumentStatus,
      removeDocument,
      recordInvoicePayment,
      addInvoiceWithOptionalReceipt,
    }),
    [
      docs,
      quotations,
      invoices,
      receipts,
      inquiries,
      addDocument,
      updateDocument,
      updateDocumentStatus,
      removeDocument,
      recordInvoicePayment,
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
