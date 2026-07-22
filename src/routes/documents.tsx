import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Eye, FileText, PackageSearch, Pencil, Receipt, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { CreateInvoiceDialog } from "@/components/app/create-invoice-dialog";
import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { useCart } from "@/components/app/cart-context";
import {
  useDocuments,
  type InquiryStatus,
  type InvoiceStatus,
  type QuoteStatus,
  type SavedDocument,
} from "@/components/app/documents-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { openSavedDocument } from "@/lib/document-export";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Parts Village" },
      {
        name: "description",
        content: "Generate and manage quotations, invoices, and supplier inquiries.",
      },
    ],
  }),
  component: DocumentsPage,
});

function openDoc(doc: SavedDocument) {
  openSavedDocument(doc);
  toast.success(`Opened ${doc.id}`);
}

function DocumentsPage() {
  const { query } = useSearch();
  const q = query.trim().toLowerCase();
  const { quotations, invoices, inquiries, updateDocumentStatus } = useDocuments();
  const { setDocumentKind, setCartOpen, clearCart } = useCart();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SavedDocument | null>(null);

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

  const startNew = (kind: "quotation" | "invoice" | "inquiry") => {
    clearCart();
    setDocumentKind(kind);
    setCartOpen(true);
    toast.message(`New ${kind} — add parts from inventory`);
  };

  const openNewInvoice = () => {
    setEditingInvoice(null);
    setInvoiceOpen(true);
  };

  const openEditInvoice = (doc: SavedDocument) => {
    setEditingInvoice(doc);
    setInvoiceOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Quotations, invoices, and supplier inquiries"
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <CreateInvoiceDialog
          open={invoiceOpen}
          document={editingInvoice}
          onOpenChange={(open) => {
            setInvoiceOpen(open);
            if (!open) setEditingInvoice(null);
          }}
        />
        <Tabs defaultValue={invoices.length > 0 ? "invoices" : "quotations"}>
          <TabsList>
            <TabsTrigger value="quotations">
              <FileText className="mr-2 h-4 w-4" />
              Quotations ({quotations.length})
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="mr-2 h-4 w-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="inquiries">
              <PackageSearch className="mr-2 h-4 w-4" />
              Inquiries ({inquiries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotations" className="mt-4">
            <DocCard
              title="Quotations"
              onNew={() => startNew("quotation")}
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
                  <OpenButton key="o" onOpen={() => openDoc(qu)} />,
                ],
              }))}
              empty={q ? `No quotations match “${query}”.` : "No quotations yet — finish a cart checkout."}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <DocCard
              title="Invoices"
              onNew={openNewInvoice}
              headers={["#", "Client", "Date", "Parts", "Total", "Status", ""]}
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
                    {currency(iv.total)}
                  </span>,
                  <StatusSelect
                    key="s"
                    doc={iv}
                    options={["Paid", "Unpaid", "Overdue"]}
                    onChange={(s) => updateDocumentStatus(iv.id, s as InvoiceStatus)}
                  />,
                  <div key="o" className="flex flex-wrap items-center justify-end gap-1.5">
                    <EditButton onEdit={() => openEditInvoice(iv)} />
                    <OpenButton onOpen={() => openDoc(iv)} />
                  </div>,
                ],
              }))}
              empty={
                q
                  ? `No invoices match “${query}”.`
                  : "No invoices yet — click + New Invoice to create one."
              }
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
                  <OpenButton key="o" onOpen={() => openDoc(s)} />,
                ],
              }))}
              empty={q ? `No inquiries match “${query}”.` : "No inquiries yet — finish a cart checkout."}
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
      className="font-mono text-xs font-medium text-accent underline-offset-2 hover:underline"
    >
      {id}
    </button>
  );
}

function OpenButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 gap-1.5"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <Eye className="h-3.5 w-3.5" />
      Open
    </Button>
  );
}

function EditButton({ onEdit }: { onEdit: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 gap-1.5"
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </Button>
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
  headers,
  rows,
  empty,
}: {
  title: string;
  onNew: () => void;
  headers: string[];
  rows: { key: string; onOpen: () => void; cells: ReactNode[] }[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button
          size="sm"
          onClick={onNew}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          + New {title.replace(/s$/, "")}
        </Button>
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
                <TableCell
                  colSpan={headers.length}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
