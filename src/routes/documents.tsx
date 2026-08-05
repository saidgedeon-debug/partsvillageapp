import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Banknote,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Receipt,
  Share2,
  StickyNote,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { CreateInvoiceDialog } from "@/components/app/create-invoice-dialog";
import { CreateReturnDialog } from "@/components/app/create-return-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { RecordPaymentDialog } from "@/components/app/record-payment-dialog";
import { PageHeader } from "@/components/app/page-header";
import { PdfPreviewDialog } from "@/components/app/pdf-preview-dialog";
import { useSearch } from "@/components/app/search-context";
import { useCart } from "@/components/app/cart-context";
import {
  invoiceAmountPaid,
  invoiceHasReturnableLines,
  invoiceRemaining,
  useDocuments,
  type InquiryStatus,
  type InvoiceStatus,
  type QuoteStatus,
  type SavedDocument,
} from "@/components/app/documents-context";
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
import { downloadSavedDocument, openSavedDocument, shareSavedDocument } from "@/lib/document-export";
import { currency } from "@/lib/mock-data";
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
  const { quotations, invoices, receipts, creditNotes, inquiries, updateDocumentStatus } =
    useDocuments();
  const { setDocumentKind, setCartOpen, clearCart } = useCart();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<SavedDocument | null>(null);
  const [docKind, setDocKind] = useState<"invoice" | "quotation">("invoice");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<SavedDocument | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<SavedDocument | null>(null);
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
          (x.internalNote ?? "").toLowerCase().includes(q),
      ),
    [q, receipts],
  );
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

  const withReceiptBalance = (doc: SavedDocument) => {
    if (doc.kind !== "receipt" || !doc.invoiceId) return doc;
    const inv = invoices.find((i) => i.id === doc.invoiceId);
    if (!inv) return doc;
    return {
      ...doc,
      invoiceTotal: inv.total,
      amountPaidAfter: invoiceAmountPaid(inv),
    } as SavedDocument & { invoiceTotal: number; amountPaidAfter: number };
  };

  const openDoc = (doc: SavedDocument) => {
    const enriched = withReceiptBalance(doc);
    const { id, blobUrl } = openSavedDocument(enriched);
    setPreview({ id, blobUrl, doc });
  };

  const downloadDoc = (doc: SavedDocument) => {
    downloadSavedDocument(withReceiptBalance(doc));
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
            if (preview) downloadDoc(preview.doc);
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
                    onChange={(s) => updateDocumentStatus(qu.id, s as QuoteStatus)}
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
              headers={["#", "Client", "Date", "Parts", "Paid / Total", "Status", ""]}
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
                    onChange={(s) => updateDocumentStatus(iv.id, s as InvoiceStatus)}
                  />,
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
              rows={filteredReceipts.map((rc) => ({
                key: rc.id,
                onOpen: () => openDoc(rc),
                cells: [
                  <DocIdLink key="i" id={rc.id} onOpen={() => openDoc(rc)} />,
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
                    <OpenButton
                      onOpen={() => openDoc(rc)}
                      onDownload={() => downloadDoc(rc)}
                      onShare={() => void shareDoc(rc)}
                      extraItems={[
                        {
                          label: "Edit payment",
                          icon: Pencil,
                          onSelect: () => openEditReceipt(rc),
                        },
                      ]}
                    />
                  </div>,
                ],
              }))}
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
            className="bg-accent text-accent-foreground hover:bg-accent/90"
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
