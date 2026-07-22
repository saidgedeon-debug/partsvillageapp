import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import type { CartLine, DocumentKind, PartyKind } from "@/components/app/cart-context";
import { useCloudState } from "@/lib/cloud-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Rejected";
export type InvoiceStatus = "Paid" | "Unpaid" | "Overdue";
export type InquiryStatus = "Open" | "Answered" | "Closed";

export type SavedDocument = {
  id: string;
  kind: DocumentKind;
  partyKind: PartyKind;
  partyId?: string;
  partyName: string;
  date: string;
  createdAt: string;
  total: number;
  status: QuoteStatus | InvoiceStatus | InquiryStatus;
  includeCost?: boolean;
  lines: CartLine[];
  stockDeducted?: boolean;
};

type DocumentsContextValue = {
  documents: SavedDocument[];
  quotations: SavedDocument[];
  invoices: SavedDocument[];
  inquiries: SavedDocument[];
  addDocument: (doc: SavedDocument) => void;
  updateDocumentStatus: (id: string, status: SavedDocument["status"]) => void;
  removeDocument: (id: string) => void;
};

const STORAGE_KEY = "parts-village-documents-v1";

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

async function syncDocumentToSupabase(doc: SavedDocument) {
  if (!supabase || !isSupabaseConfigured) return;
  try {
    if (doc.kind === "quotation") {
      await supabase.from("quotations").upsert({
        id: doc.id,
        client_id: doc.partyId || doc.partyName,
        date: doc.date,
        total: doc.total,
        status: (doc.status as QuoteStatus) || "Sent",
      } as never);
    } else if (doc.kind === "invoice") {
      await supabase.from("invoices").upsert({
        id: doc.id,
        client_id: doc.partyId || doc.partyName,
        date: doc.date,
        total: doc.total,
        status: (doc.status as InvoiceStatus) || "Unpaid",
      } as never);
    } else {
      await supabase.from("supplier_inquiries").upsert({
        id: doc.id,
        supplier: doc.partyName,
        date: doc.date,
        part_numbers: doc.lines.map((l) => l.partNumber),
        status: (doc.status as InquiryStatus) || "Open",
      } as never);
    }
  } catch {
    // local is source of truth
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

  const updateDocumentStatus = useCallback(
    (id: string, status: SavedDocument["status"]) => {
      setDocuments((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const next = list.map((d) => (d.id === id ? { ...d, status } : d));
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

  const docs = Array.isArray(documents) ? documents : [];

  const quotations = useMemo(() => docs.filter((d) => d.kind === "quotation"), [docs]);
  const invoices = useMemo(() => docs.filter((d) => d.kind === "invoice"), [docs]);
  const inquiries = useMemo(() => docs.filter((d) => d.kind === "inquiry"), [docs]);

  const value = useMemo(
    () => ({
      documents: docs,
      quotations,
      invoices,
      inquiries,
      addDocument,
      updateDocumentStatus,
      removeDocument,
    }),
    [docs, quotations, invoices, inquiries, addDocument, updateDocumentStatus, removeDocument],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}
