import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Banknote,
  Download,
  Eye,
  FileInput,
  FileOutput,
  FileText,
  FileUp,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Receipt,
  Share2,
  Split,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { CreateInvoiceDialog } from "@/components/app/create-invoice-dialog";
import { CreateReturnDialog } from "@/components/app/create-return-dialog";
import { confirmAction } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { QuotationExcelImportDialog } from "@/components/app/quotation-excel-import-dialog";
import { RecordPaymentDialog } from "@/components/app/record-payment-dialog";
import { ReallocatePaymentBatchDialog } from "@/components/app/reallocate-payment-batch-dialog";
import { PageHeader } from "@/components/app/page-header";
import { PdfPreviewDialog } from "@/components/app/pdf-preview-dialog";
import { useSearch } from "@/components/app/search-context";
import { useCart } from "@/components/app/cart-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import {
  deleteReceiptConfirmMessage,
  invoiceAmountPaid,
  invoiceHasReturnableLines,
  invoiceRemaining,
  receiptWithBalanceSnapshot,
  useDocuments,
  type InquiryStatus,
  type InvoiceStatus,
  type QuoteStatus,
  type SavedDocument,
} from "@/components/app/documents-context";
import { FULFILLMENT_STATUSES, type FulfillmentStatus } from "@/lib/fulfillment";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isDocumentCreatedPart } from "@/lib/document-created-parts";
import { downloadSavedDocument, openSavedDocument, shareSavedDocument, paymentHistoryLinesForInvoice } from "@/lib/document-export";
import { currency } from "@/lib/mock-data";
import {
  computeOversoldByPart,
  confirmOversell,
  lineQtyByPart,
  physicalRestockCap,
  stockShortagesForQty,
} from "@/lib/stock-sale";
import { cn } from "@/lib/utils";
const DOC_TABS = ["quotations", "invoices", "receipts", "credit_notes", "inquiries"] as const;
type DocTab = (typeof DOC_TABS)[number];

function parseDocTab(value: unknown): DocTab {
  if (typeof value === "string" && (DOC_TABS as readonly string[]).includes(value)) {
    return value as DocTab;
  }
  return "quotations";
}

export const Route = createFileRoute("/documents")({
  validateSearch: (search: Record<string, unknown>): { tab: DocTab } => ({
    tab: parseDocTab(search.tab),
  }),
  head: () => ({
    meta: [
      { title: "Documents — Parts Village" },
      {
        name: "description",
        content:
          "Generate and manage quotations, invoices, receipts, credit notes, and supplier inquiries.",
      },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const navigate = useNavigate({ from: "/documents" });
  const { tab } = Route.useSearch();
  const { query } = useSearch();
  const q = query.trim().toLowerCase();
  const {
    quotations,
    invoices,
    receipts,
    creditNotes,
    inquiries,
    updateDocumentStatus,
    updateDocument,
    deleteInvoicePayment,
    convertQuotationToInvoice,
    convertInvoiceToQuotation,
  } = useDocuments();
  const { adjustPartQuantity, getPart } = useInventory();
  const { clients } = useParties();
  const { addOrder, orders, removeOrder } = useFleet();
  const { setDocumentKind, setCartOpen, clearCart } = useCart();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<SavedDocument | null>(null);
  const [docKind, setDocKind] = useState<"invoice" | "quotation">("invoice");
  const [quoteImportOpen, setQuoteImportOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<SavedDocument | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<SavedDocument | null>(null);
  const [reallocateBatchId, setReallocateBatchId] = useState<string | null>(null);
  const [reallocateOpen, setReallocateOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState<SavedDocument | null>(null);
  const [preview, setPreview] = useState<{ id: string; blobUrl: string; doc: SavedDocument } | null>(
    null,
  );

  const filteredQuotes = useMemo(
    () =>
      quotations.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          x.partyName.toLowerCase().includes(q) ||
          x.lines.some((l) => l.partNumber.toLowerCase().includes(q)),
      ),
    [q, quotations],
  );
  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          x.partyName.toLowerCase().includes(q) ||
          (x.internalNote ?? "").toLowerCase().includes(q) ||
          x.lines.some((l) => l.partNumber.toLowerCase().includes(q)),
      ),
    [q, invoices],
  );
  const filteredReceipts = useMemo(
    () =>
      receipts.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          x.partyName.toLowerCase().includes(q) ||
          (x.invoiceId ?? "").toLowerCase().includes(q) ||
          (x.paymentMethod ?? "").toLowerCase().includes(q) ||
          (x.paymentMobile ?? "").toLowerCase().includes(q) ||
          (x.paymentBatchId ?? "").toLowerCase().includes(q) ||
          (x.internalNote ?? "").toLowerCase().includes(q),
      ),
    [q, receipts],
  );

  const receiptBatchTotals = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const rc of receipts) {
      const bid = rc.paymentBatchId?.trim();
      if (!bid) continue;
      const cur = map.get(bid) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total = Math.round((cur.total + rc.total) * 100) / 100;
      map.set(bid, cur);
    }
    for (const cn of creditNotes) {
      const bid = cn.paymentBatchId?.trim();
      if (!bid) continue;
      const cur = map.get(bid) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total = Math.round((cur.total + cn.total) * 100) / 100;
      map.set(bid, cur);
    }
    return map;
  }, [receipts, creditNotes]);

  const sortedReceipts = useMemo(() => {
    return [...filteredReceipts].sort((a, b) => {
      const ba = a.paymentBatchId ?? "";
      const bb = b.paymentBatchId ?? "";
      if (ba !== bb) {
        if (!ba) return 1;
        if (!bb) return -1;
        return bb.localeCompare(ba);
      }
      return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
    });
  }, [filteredReceipts]);
  const invoicesWithReceipt = useMemo(
    () =>
      new Set(receipts.map((r) => r.invoiceId).filter((id): id is string => Boolean(id))),
    [receipts],
  );
  const filteredCreditNotes = useMemo(
    () =>
      creditNotes.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          x.partyName.toLowerCase().includes(q) ||
          (x.invoiceId ?? "").toLowerCase().includes(q) ||
          (x.internalNote ?? "").toLowerCase().includes(q) ||
          x.lines.some((l) => l.partNumber.toLowerCase().includes(q)),
      ),
    [q, creditNotes],
  );
  const filteredInquiries = useMemo(
    () =>
      inquiries.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          x.partyName.toLowerCase().includes(q) ||
          x.lines.some((l) => l.partNumber.toLowerCase().includes(q)),
      ),
    [q, inquiries],
  );

  const setTab = (next: string) => {
    void navigate({
      search: { tab: parseDocTab(next) },
      replace: true,
    });
  };

  const startNew = (kind: "quotation" | "invoice" | "inquiry") => {
    clearCart();
    setDocumentKind(kind);
    setCartOpen(true);
    toast.message(`New ${kind} — add parts from inventory`);
  };

  const openNewInvoice = () => {
    setEditingDocument(null);
    setDocKind("invoice");
    setInvoiceOpen(true);
  };

  const openNewQuotation = () => {
    setEditingDocument(null);
    setDocKind("quotation");
    setInvoiceOpen(true);
  };

  const openEditDocument = (doc: SavedDocument) => {
    if (doc.kind !== "invoice" && doc.kind !== "quotation") return;
    setDocKind(doc.kind);
    setEditingDocument(doc);
    setInvoiceOpen(true);
  };

  const convertQuoteToInvoice = async (quote: SavedDocument) => {
    if (quote.kind !== "quotation") return;
    const convertOk = await confirmAction({
      title: `Convert ${quote.id} to invoice?`,
      description: `Create an unpaid invoice for ${quote.partyName}.`,
      confirmLabel: "Convert",
    });
    if (!convertOk) return;
    const deductStock = await confirmAction({
      title: "Deduct stock?",
      description: "Deduct stock for these lines now?",
      confirmLabel: "Deduct stock",
      cancelLabel: "Keep stock",
    });

    let stockDeducted = false;
    let oversoldByPart: Record<string, number> | undefined;
    if (deductStock) {
      const skipCreated = new Set(
        quote.lines.filter((l) => isDocumentCreatedPart(l.partId)).map((l) => l.partId),
      );
      const needed = lineQtyByPart(quote.lines);
      if (!(await confirmOversell(stockShortagesForQty(needed, getPart, skipCreated)))) return;

      oversoldByPart = computeOversoldByPart(needed, getPart, skipCreated);
      for (const line of quote.lines) {
        const part = getPart(line.partId);
        if (!part) continue;
        if (isDocumentCreatedPart(line.partId) && part.quantity < line.qty) {
          adjustPartQuantity(line.partId, line.qty - part.quantity);
        }
        adjustPartQuantity(line.partId, -line.qty);
        stockDeducted = true;
      }
    }

    try {
      const invoice = convertQuotationToInvoice(quote.id, {
        stockDeducted,
        oversoldByPart,
      });
      const client =
        (invoice.partyId && clients.find((c) => c.id === invoice.partyId)) ||
        clients.find((c) => c.name.toLowerCase() === invoice.partyName.trim().toLowerCase());
      if (client) {
        addOrder({
          id: `ord-${invoice.id}`,
          clientId: client.id,
          machineId: "",
          date: invoice.date,
          status: "Pending",
          documentId: invoice.id,
          lines: invoice.lines.map((l) => ({
            partId: l.partId,
            partNumber: l.partNumber,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
          })),
        });
      }
      toast.success(
        `${quote.id} → ${invoice.id}` + (stockDeducted ? " · stock deducted" : ""),
      );
      void navigate({ search: { tab: "invoices" }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Convert failed");
    }
  };

  const revertInvoiceToQuote = async (invoice: SavedDocument) => {
    if (invoice.kind !== "invoice") return;
    const ok = await confirmAction({
      title: `Revert ${invoice.id} to a quotation?`,
      description:
        "Only unpaid invoices with no receipts or returns can be reverted." +
        (invoice.stockDeducted ? "\nStock that was deducted will be restored." : ""),
      confirmLabel: "Revert",
      destructive: true,
    });
    if (!ok) return;

    try {
      if (invoice.stockDeducted) {
        const soldByPart = lineQtyByPart(invoice.lines);
        for (const [partId, soldQty] of soldByPart) {
          if (!getPart(partId)) continue;
          const oversoldQty = invoice.oversoldByPart?.[partId] ?? 0;
          const qty = physicalRestockCap(soldQty, oversoldQty, 0);
          if (qty > 0) adjustPartQuantity(partId, qty);
        }
      }
      const quote = convertInvoiceToQuotation(invoice.id);
      for (const order of orders) {
        if (order.documentId === invoice.id || order.id === `ord-${invoice.id}`) {
          removeOrder(order.id);
        }
      }
      toast.success(`${invoice.id} → ${quote.id}`);
      void navigate({ search: { tab: "quotations" }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revert failed");
    }
  };

  const openReceivePayment = (doc?: SavedDocument | null) => {
    setEditingReceipt(null);
    setPaymentInvoice(doc ?? null);
    setPaymentOpen(true);
  };

  const openEditReceipt = (doc: SavedDocument) => {
    setPaymentInvoice(null);
    setEditingReceipt(doc);
    setPaymentOpen(true);
  };

  const openReturn = (doc?: SavedDocument | null) => {
    setReturnInvoice(doc ?? null);
    setReturnOpen(true);
  };

  const withReceiptBalance = (doc: SavedDocument) =>
    receiptWithBalanceSnapshot(doc, invoices, creditNotes);

  const openDoc = async (doc: SavedDocument) => {
    const enriched = withReceiptBalance(doc);
    const paymentHistory =
      enriched.kind === "invoice"
        ? paymentHistoryLinesForInvoice(enriched.id, receipts)
        : undefined;
    const { id, blobUrl } = await openSavedDocument({
      ...enriched,
      ...(paymentHistory?.length ? { paymentHistory } : {}),
    });
    setPreview({ id, blobUrl, doc });
  };

  const downloadDoc = async (doc: SavedDocument) => {
    await downloadSavedDocument(withReceiptBalance(doc));
    toast.success(`Downloaded ${doc.id}.pdf`);
  };

  const shareDoc = async (doc: SavedDocument) => {
    const result = await shareSavedDocument(withReceiptBalance(doc));
    if (result.cancelled) {
      toast.message("Share cancelled");
      return;
    }
    if (result.shared) {
      toast.success(`Shared ${result.id}.pdf`);
      return;
    }
    toast.success(`Downloaded ${result.id}.pdf — attach the file when sharing`);
  };

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Quotations, invoices, receipts, credit notes, and supplier inquiries"
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <CreateInvoiceDialog
          open={invoiceOpen}
          document={editingDocument}
          kind={docKind}
          onOpenChange={(open) => {
            setInvoiceOpen(open);
            if (!open) setEditingDocument(null);
          }}
        />
        <QuotationExcelImportDialog
          open={quoteImportOpen}
          onOpenChange={setQuoteImportOpen}
          onImported={(quotation) => {
            void navigate({ search: { tab: "quotations" }, replace: true });
            toast.success(`Opened quotations · ${quotation.id}`);
          }}
        />
        <RecordPaymentDialog
          open={paymentOpen}
          invoice={paymentInvoice}
          receipt={editingReceipt}
          onOpenChange={(open) => {
            setPaymentOpen(open);
            if (!open) {
              setPaymentInvoice(null);
              setEditingReceipt(null);
            }
          }}
          onRecorded={(receipt) => {
            openDoc(receipt);
            void navigate({ search: { tab: "receipts" }, replace: true });
          }}
        />
        <ReallocatePaymentBatchDialog
          open={reallocateOpen}
          batchId={reallocateBatchId}
          onOpenChange={(open) => {
            setReallocateOpen(open);
            if (!open) setReallocateBatchId(null);
          }}
        />
        <CreateReturnDialog
          open={returnOpen}
          invoice={returnInvoice}
          onOpenChange={(open) => {
            setReturnOpen(open);
            if (!open) setReturnInvoice(null);
          }}
          onRecorded={(creditNote) => {
            openDoc(creditNote);
            void navigate({ search: { tab: "credit_notes" }, replace: true });
          }}
        />
        <PdfPreviewDialog
          open={Boolean(preview)}
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          title={preview?.id ?? "Document"}
          blobUrl={preview?.blobUrl ?? null}
          onDownload={() => {
            if (preview) void downloadDoc(preview.doc);
          }}
          onShare={() => {
            if (preview) void shareDoc(preview.doc);
          }}
        />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="quotations">
              <FileText className="mr-2 h-4 w-4" />
              Quotations ({quotations.length})
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <StickyNote className="mr-2 h-4 w-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="receipts">
              <Receipt className="mr-2 h-4 w-4" />
              Receipts ({receipts.length})
            </TabsTrigger>
            <TabsTrigger value="credit_notes">
              <Undo2 className="mr-2 h-4 w-4" />
              Credit notes ({creditNotes.length})
            </TabsTrigger>
            <TabsTrigger value="inquiries">
              <PackageSearch className="mr-2 h-4 w-4" />
              Inquiries ({inquiries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotations" className="mt-4">
            <DocCard
              title="Quotations"
              onNew={openNewQuotation}
              extraAction={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setQuoteImportOpen(true)}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Import Excel
                </Button>
              }
              headers={["#", "Client", "Date", "Parts", "Total", "Status", ""]}
              rows={filteredQuotes.map((qu) => ({
                key: qu.id,
                onOpen: () => openDoc(qu),
                cells: [
                  <DocIdLink key="i" id={qu.id} onOpen={() => openDoc(qu)} />,
                  qu.partyName,
                  qu.date,
                  <span key="p" className="font-mono text-xs text-muted-foreground">
                    {qu.lines.map((l) => l.partNumber).join(", ")}
                  </span>,
                  <span key="t" className="font-semibold">
                    {currency(qu.total)}
                  </span>,
                  <StatusSelect
                    key="s"
                    doc={qu}
                    options={["Draft", "Sent", "Accepted", "Rejected"]}
                    onChange={(s) => {
                      if (s === "Accepted") {
                        convertQuoteToInvoice(qu);
                        return;
                      }
                      updateDocumentStatus(qu.id, s as QuoteStatus);
                    }}
                  />,
                  <OpenButton
                    key="o"
                    onOpen={() => openDoc(qu)}
                    onDownload={() => downloadDoc(qu)}
                    onShare={() => void shareDoc(qu)}
                    extraItems={[
                      {
                        label: "Edit",
                        icon: Pencil,
                        onSelect: () => openEditDocument(qu),
                      },
                      {
                        label: "Convert to invoice",
                        icon: FileOutput,
                        onSelect: () => convertQuoteToInvoice(qu),
                      },
                    ]}
                  />,
                ],
              }))}
              emptyTitle={q ? `No quotations match “${query}”` : "No quotations yet"}
              emptyDescription={
                q ? "Try a different search." : "Click + New to create one, or use the cart."
              }
              emptyIcon={FileText}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <DocCard
              title="Invoices"
              onNew={openNewInvoice}
              extraAction={
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => openReceivePayment(null)}
                >
                  <Banknote className="h-3.5 w-3.5" />
                  Record payment
                </Button>
              }
              headers={["#", "Client", "Date", "Parts", "Paid / Total", "Status", "Fulfillment", ""]}
              rows={filteredInvoices.map((iv) => ({
                key: iv.id,
                onOpen: () => openDoc(iv),
                cells: [
                  <div key="i" className="flex items-center gap-1.5">
                    <DocIdLink id={iv.id} onOpen={() => openDoc(iv)} />
                    {iv.internalNote?.trim() ? (
                      <span title={iv.internalNote} className="text-muted-foreground">
                        <StickyNote className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>,
                  iv.partyName,
                  iv.date,
                  <span key="p" className="font-mono text-xs text-muted-foreground">
                    {iv.lines.map((l) => l.partNumber).join(", ")}
                  </span>,
                  <span key="t" className="font-semibold">
                    {currency(invoiceAmountPaid(iv))}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      / {currency(iv.total)}
                    </span>
                  </span>,
                  <StatusSelect
                    key="s"
                    doc={iv}
                    options={["Paid", "Partial", "Unpaid", "Overdue"]}
                    onChange={(s) => {
                      if (s === "Paid" || s === "Partial") {
                        const remaining = invoiceRemaining(iv, creditNotes);
                        if (remaining > 0.005) {
                          toast.message(
                            "Record a receipt with Pay to mark this paid. Status follows real payments.",
                          );
                        }
                      }
                      updateDocumentStatus(iv.id, s as InvoiceStatus);
                    }}
                  />,
                  <Select
                    key="f"
                    value={iv.fulfillmentStatus ?? "__none__"}
                    onValueChange={(v) => {
                      updateDocument({
                        ...iv,
                        fulfillmentStatus:
                          v === "__none__" ? undefined : (v as FulfillmentStatus),
                      });
                    }}
                  >
                    <SelectTrigger
                      className="h-8 w-[130px] text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {FULFILLMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>,
                  <div key="o" className="flex flex-wrap items-center justify-end gap-1.5">
                    {invoiceRemaining(iv, creditNotes) > 0.005 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReceivePayment(iv);
                        }}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        Pay
                      </Button>
                    ) : !invoicesWithReceipt.has(iv.id) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReceivePayment(iv);
                        }}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        Receipt
                      </Button>
                    ) : null}
                    {invoiceHasReturnableLines(iv, creditNotes) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReturn(iv);
                        }}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Return
                      </Button>
                    ) : null}
                    <OpenButton
                      onOpen={() => openDoc(iv)}
                      onDownload={() => downloadDoc(iv)}
                      onShare={() => void shareDoc(iv)}
                      extraItems={[
                        {
                          label: "Edit",
                          icon: Pencil,
                          onSelect: () => openEditDocument(iv),
                        },
                        ...(invoiceAmountPaid(iv) <= 0.005 &&
                        !creditNotes.some((c) => c.invoiceId === iv.id) &&
                        !receipts.some((r) => r.invoiceId === iv.id)
                          ? [
                              {
                                label: "Revert to quotation",
                                icon: FileInput,
                                onSelect: () => revertInvoiceToQuote(iv),
                              },
                            ]
                          : []),
                        ...(invoiceHasReturnableLines(iv, creditNotes)
                          ? [
                              {
                                label: "Return parts",
                                icon: Undo2,
                                onSelect: () => openReturn(iv),
                              },
                            ]
                          : []),
                        ...(invoiceRemaining(iv, creditNotes) <= 0.005
                          ? [
                              {
                                label: "Create receipt",
                                icon: Banknote,
                                onSelect: () => openReceivePayment(iv),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>,
                ],
              }))}
              emptyTitle={q ? `No invoices match “${query}”` : "No invoices yet"}
              emptyDescription={
                q ? "Try a different search." : "Click + New Invoice to create one."
              }
              emptyIcon={Receipt}
            />
          </TabsContent>

          <TabsContent value="receipts" className="mt-4">
            <DocCard
              title="Receipts"
              onNew={() => openReceivePayment(null)}
              newLabel="Record payment"
              headers={["#", "Client", "Date", "Invoice", "Method", "Amount", ""]}
              rows={sortedReceipts.map((rc) => {
                const batchId = rc.paymentBatchId?.trim();
                const batchMeta = batchId ? receiptBatchTotals.get(batchId) : undefined;
                const showReallocate = Boolean(batchId && batchMeta && batchMeta.count >= 1);
                return {
                key: rc.id,
                onOpen: () => openDoc(rc),
                cells: [
                  <div key="i" className="space-y-1">
                    <DocIdLink id={rc.id} onOpen={() => openDoc(rc)} />
                    {batchId ? (
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        Batch · {batchMeta?.count ?? 1} · {currency(batchMeta?.total ?? rc.total)}
                      </Badge>
                    ) : null}
                  </div>,
                  rc.partyName,
                  rc.paymentDate || rc.date,
                  <span key="inv" className="font-mono text-xs">
                    {rc.invoiceId ?? "—"}
                  </span>,
                  <span key="m" className="text-xs">
                    {rc.paymentMethod ?? "—"}
                    {rc.paymentMobile ? (
                      <span className="block text-muted-foreground">{rc.paymentMobile}</span>
                    ) : null}
                  </span>,
                  <span key="t" className="font-semibold">
                    {currency(rc.total)}
                  </span>,
                  <div key="o" className="flex flex-wrap items-center justify-end gap-1.5">
                    {showReallocate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReallocateBatchId(batchId!);
                          setReallocateOpen(true);
                        }}
                      >
                        <Split className="h-3.5 w-3.5" />
                        Reallocate
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditReceipt(rc);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        void (async () => {
                          const ok = await confirmAction({
                            title: "Delete receipt?",
                            description: deleteReceiptConfirmMessage(rc),
                            confirmLabel: "Delete",
                            destructive: true,
                          });
                          if (!ok) return;
                          try {
                            deleteInvoicePayment(rc.id);
                            toast.success(`Deleted ${rc.id}`);
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Failed to delete receipt",
                            );
                          }
                        })();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                    <OpenButton
                      onOpen={() => openDoc(rc)}
                      onDownload={() => downloadDoc(rc)}
                      onShare={() => void shareDoc(rc)}
                      extraItems={[
                        ...(showReallocate
                          ? [
                              {
                                label: "Reallocate batch",
                                icon: Split,
                                onSelect: () => {
                                  setReallocateBatchId(batchId!);
                                  setReallocateOpen(true);
                                },
                              },
                            ]
                          : []),
                        {
                          label: "Edit payment",
                          icon: Pencil,
                          onSelect: () => openEditReceipt(rc),
                        },
                        {
                          label: "Delete payment",
                          icon: Trash2,
                          onSelect: () => {
                            void (async () => {
                              const ok = await confirmAction({
                                title: "Delete receipt?",
                                description: deleteReceiptConfirmMessage(rc),
                                confirmLabel: "Delete",
                                destructive: true,
                              });
                              if (!ok) return;
                              try {
                                deleteInvoicePayment(rc.id);
                                toast.success(`Deleted ${rc.id}`);
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to delete receipt",
                                );
                              }
                            })();
                          },
                        },
                      ]}
                    />
                  </div>,
                ],
              };
              })}
              emptyTitle={
                q ? `No receipts match “${query}”` : "No receipts yet"
              }
              emptyDescription={
                q ? "Try a different search." : "Record a payment on an invoice."
              }
              emptyIcon={Banknote}
            />
          </TabsContent>

          <TabsContent value="credit_notes" className="mt-4">
            <DocCard
              title="Credit notes"
              onNew={() => openReturn(null)}
              newLabel="Return from invoice"
              headers={["#", "Client", "Date", "Invoice", "Parts", "Credit", ""]}
              rows={filteredCreditNotes.map((cn) => ({
                key: cn.id,
                onOpen: () => openDoc(cn),
                cells: [
                  <DocIdLink key="i" id={cn.id} onOpen={() => openDoc(cn)} />,
                  cn.partyName,
                  cn.date,
                  <span key="inv" className="font-mono text-xs">
                    {cn.invoiceId ?? "—"}
                  </span>,
                  <span key="p" className="font-mono text-xs text-muted-foreground">
                    {cn.lines.map((l) => `${l.partNumber}×${l.qty}`).join(", ")}
                  </span>,
                  <span key="t" className="font-semibold">
                    {currency(cn.total)}
                  </span>,
                  <OpenButton
                    key="o"
                    onOpen={() => openDoc(cn)}
                    onDownload={() => downloadDoc(cn)}
                    onShare={() => void shareDoc(cn)}
                  />,
                ],
              }))}
              emptyTitle={
                q ? `No credit notes match “${query}”` : "No credit notes yet"
              }
              emptyDescription={
                q
                  ? "Try a different search."
                  : "Return parts from an invoice to create a credit note."
              }
              emptyIcon={Undo2}
            />
          </TabsContent>

          <TabsContent value="inquiries" className="mt-4">
            <DocCard
              title="Supplier Inquiries"
              onNew={() => startNew("inquiry")}
              newLabel="New inquiry"
              headers={["#", "Supplier", "Date", "Part Numbers", "Status", ""]}
              rows={filteredInquiries.map((s) => ({
                key: s.id,
                onOpen: () => openDoc(s),
                cells: [
                  <DocIdLink key="i" id={s.id} onOpen={() => openDoc(s)} />,
                  s.partyName,
                  s.date,
                  <span key="p" className="font-mono text-xs text-muted-foreground">
                    {s.lines.map((l) => l.partNumber).join(", ")}
                  </span>,
                  <StatusSelect
                    key="st"
                    doc={s}
                    options={["Open", "Answered", "Closed"]}
                    onChange={(st) => updateDocumentStatus(s.id, st as InquiryStatus)}
                  />,
                  <OpenButton
                    key="o"
                    onOpen={() => openDoc(s)}
                    onDownload={() => downloadDoc(s)}
                    onShare={() => void shareDoc(s)}
                  />,
                ],
              }))}
              emptyTitle={q ? `No inquiries match “${query}”` : "No inquiries yet"}
              emptyDescription={
                q ? "Try a different search." : "Finish a cart checkout to create one."
              }
              emptyIcon={PackageSearch}
            />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function DocIdLink({ id, onOpen }: { id: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="font-mono text-xs font-medium text-primary underline-offset-2 hover:underline"
    >
      {id}
    </button>
  );
}

function OpenButton({
  onOpen,
  onDownload,
  onShare,
  extraItems,
}: {
  onOpen: () => void;
  onDownload: () => void;
  onShare?: () => void;
  extraItems?: { label: string; icon?: typeof Pencil; onSelect: () => void }[];
}) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        onClick={onOpen}
      >
        <Eye className="h-3.5 w-3.5" />
        Open
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="More document actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(extraItems ?? []).map((item) => (
            <DropdownMenuItem key={item.label} onClick={item.onSelect}>
              {item.icon ? <item.icon className="h-3.5 w-3.5" /> : null}
              {item.label}
            </DropdownMenuItem>
          ))}
          {onShare ? (
            <DropdownMenuItem onClick={onShare}>
              <Share2 className="h-3.5 w-3.5" />
              Share PDF
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            Download
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StatusSelect({
  doc,
  options,
  onChange,
}: {
  doc: SavedDocument;
  options: string[];
  onChange: (status: string) => void;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Select value={doc.status} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DocCard({
  title,
  onNew,
  newLabel,
  extraAction,
  headers,
  rows,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
}: {
  title: string;
  onNew: () => void;
  newLabel?: string;
  extraAction?: ReactNode;
  headers: string[];
  rows: { key: string; onOpen: () => void; cells: ReactNode[] }[];
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: typeof FileText;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {extraAction}
          <Button
            size="sm"
            onClick={onNew}
          >
            {newLabel ?? `+ New ${title.replace(/s$/, "")}`}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead key={`${h}-${i}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.key}
                className={cn("cursor-pointer hover:bg-muted/50")}
                onClick={r.onOpen}
              >
                {r.cells.map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={headers.length}>
                  <EmptyState icon={EmptyIcon} title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
