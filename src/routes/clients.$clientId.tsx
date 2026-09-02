import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Copy,
  Eye,
  FileText,
  Mail,
  Phone,
  MapPin,
  Truck,
  Pencil,
  StickyNote,
  Plus,
  Download,
  MessageCircle,
  Percent,
  Undo2,
  Trash2,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { confirmAction } from "@/components/app/confirm-dialog";
import { RecordPaymentDialog } from "@/components/app/record-payment-dialog";
import { ClientDiscountDialog } from "@/components/app/client-discount-dialog";
import { CreateReturnDialog } from "@/components/app/create-return-dialog";
import { useParties, type PartyRecord } from "@/components/app/parties-context";
import { useFleet } from "@/components/app/fleet-context";
import { useKits } from "@/components/app/kits-context";
import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import {
  deleteReceiptConfirmMessage,
  invoiceHasReturnableLines,
  receiptWithBalanceSnapshot,
  useDocuments,
  type SavedDocument,
} from "@/components/app/documents-context";
import { PartyFormDialog } from "@/components/app/party-form-dialog";
import { PdfPreviewDialog } from "@/components/app/pdf-preview-dialog";
import { kitMatchesMachine } from "@/lib/part-identity";
import { buildCrossSellSuggestions, flattenInvoiceHistory } from "@/lib/cross-sell";
import { ensurePortalToken, portalPath } from "@/lib/portal-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clientById, currency } from "@/lib/mock-data";
import {
  buildArStatement,
  documentBelongsToClient,
  downloadStatementPdf,
  openOverdueWhatsApp,
  openStatementWhatsApp,
} from "@/lib/ar-statement";
import {
  openSavedDocument,
  downloadSavedDocument,
  shareSavedDocument,
  paymentHistoryLinesForInvoice,
} from "@/lib/document-export";
import { statusChipClass } from "@/lib/status-styles";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client — Parts Village" },
      { name: "description", content: "Client fleet, machines, and full parts order history." },
    ],
  }),
  component: ClientDetail,
});

function kindLabel(kind: SavedDocument["kind"]) {
  if (kind === "quotation") return "Quotation";
  if (kind === "invoice") return "Invoice";
  if (kind === "receipt") return "Receipt";
  if (kind === "credit_note") return "Credit note";
  return kind;
}

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const { clients, removeClient, updateClient } = useParties();
  const { quotations, invoices, receipts, creditNotes, deleteInvoicePayment, applyUnappliedCredit } =
    useDocuments();
  const { machinesByClient, ordersByClient, ordersByMachine, addMachine } = useFleet();
  const { kits } = useKits();
  const { getPart } = useInventory();
  const { addPart, setDocumentKind, documentKind, setCartOpen } = useCart();
  const [editOpen, setEditOpen] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<SavedDocument | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<SavedDocument | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [applyCreditInvoiceId, setApplyCreditInvoiceId] = useState("");
  const [applyCreditAmount, setApplyCreditAmount] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [hours, setHours] = useState("0");
  const [promisedPayDraft, setPromisedPayDraft] = useState("");
  const [payMethodDraft, setPayMethodDraft] = useState("");
  const [preview, setPreview] = useState<{
    id: string;
    blobUrl: string;
    doc: SavedDocument;
  } | null>(null);

  const client: PartyRecord | undefined =
    clients.find((c) => c.id === clientId) ??
    (() => {
      const seed = clientById(clientId);
      if (!seed) return undefined;
      return {
        id: seed.id,
        name: seed.name,
        contactName: seed.contactName ?? "",
        email: seed.email ?? "",
        phone: seed.phone ?? "",
        address: seed.address ?? "",
      } satisfies PartyRecord;
    })();

  const clientDocs = useMemo(() => {
    if (!client) return [] as SavedDocument[];
    const nameKey = client.name.trim().toLowerCase();
    const match = (doc: SavedDocument) =>
      doc.partyKind === "client" &&
      (doc.partyId === client.id || doc.partyName.trim().toLowerCase() === nameKey);
    return [...quotations, ...invoices, ...receipts, ...creditNotes]
      .filter(match)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [client, quotations, invoices, receipts, creditNotes]);

  const openDoc = async (doc: SavedDocument) => {
    const enriched = receiptWithBalanceSnapshot(doc, invoices);
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

  useEffect(() => {
    if (!client) return;
    setPromisedPayDraft(client.promisedPayDate ?? "");
    setPayMethodDraft(client.preferredPaymentMethod ?? "");
  }, [client]);

  const statementForDefaults = useMemo(
    () => (client ? buildArStatement(client, invoices, creditNotes) : null),
    [client, invoices, creditNotes],
  );

  useEffect(() => {
    if (!statementForDefaults) return;
    if (
      statementForDefaults.unappliedCredits <= 0.005 ||
      statementForDefaults.rows.length === 0
    ) {
      setApplyCreditInvoiceId("");
      setApplyCreditAmount("");
      return;
    }
    setApplyCreditInvoiceId((prev) => {
      const stillOpen = statementForDefaults.rows.some((r) => r.invoice.id === prev);
      const invoiceId = stillOpen ? prev : statementForDefaults.rows[0]!.invoice.id;
      const row =
        statementForDefaults.rows.find((r) => r.invoice.id === invoiceId) ??
        statementForDefaults.rows[0]!;
      setApplyCreditAmount(
        String(
          Math.min(statementForDefaults.unappliedCredits, row.remaining).toFixed(2),
        ),
      );
      return invoiceId;
    });
  }, [statementForDefaults]);

  const timeline = useMemo(() => {
    if (!client) return [];
    const docs = clientDocs.map((d) => ({
      key: `doc-${d.id}`,
      date: d.paymentDate || d.date,
      kind: kindLabel(d.kind),
      id: d.id,
      amount: Number.isFinite(d.total) ? d.total : 0,
      status: d.status,
      sortAt: d.createdAt,
      doc: d as SavedDocument | null,
    }));
    const orders = ordersByClient(client.id).map((o) => ({
      key: `ord-${o.id}`,
      date: o.date,
      kind: "Fleet order",
      id: o.id,
      amount: o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
      status: o.status,
      sortAt: o.date,
      doc: null as SavedDocument | null,
    }));
    return [...docs, ...orders]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.sortAt.localeCompare(a.sortAt);
      })
      .slice(0, 20);
  }, [client, clientDocs, ordersByClient]);

  const crossSell = useMemo(() => {
    if (!client) return [];
    const first = machinesByClient(client.id)[0];
    if (!first) return [];
    const clientInvoices = invoices.filter((iv) => documentBelongsToClient(iv, client));
    return buildCrossSellSuggestions({
      make: first.make,
      model: first.model,
      kits,
      historyLines: flattenInvoiceHistory(clientInvoices),
      excludePartIds: new Set(),
      getPartMeta: (partId) => {
        const p = getPart(partId);
        return p ? { partNumber: p.partNumber, name: p.name } : undefined;
      },
      limit: 6,
    });
  }, [client, machinesByClient, kits, invoices, getPart]);

  if (!client) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Client not found.</p>
        <Link to="/clients" className="text-primary hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const fleet = machinesByClient(client.id);
  const allOrders = ordersByClient(client.id);
  const statement = statementForDefaults!;
  const canReturn = invoices.some(
    (iv) => documentBelongsToClient(iv, client) && invoiceHasReturnableLines(iv, creditNotes),
  );
  // Lifetime spend = invoice sales + standalone receipts (no linked invoice).
  // Invoice-linked receipts are payments on those invoices — counting both doubles spend.
  const invoiceSpend = clientDocs
    .filter((d) => d.kind === "invoice")
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  const standaloneReceiptSpend = clientDocs
    .filter((d) => d.kind === "receipt" && !d.invoiceId)
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  const creditsSpend = clientDocs
    .filter((d) => d.kind === "credit_note")
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  const spend = Math.max(0, invoiceSpend + standaloneReceiptSpend - creditsSpend);

  const saveMachine = () => {
    if (!make.trim() || !model.trim()) {
      toast.error("Enter make and model");
      return;
    }
    addMachine({
      clientId: client.id,
      make: make.trim(),
      model: model.trim(),
      serialNumber: serial.trim() || "—",
      year: Number(year) || new Date().getFullYear(),
      hours: Number(hours) || 0,
    });
    toast.success("Machine added");
    setMachineOpen(false);
    setMake("");
    setModel("");
    setSerial("");
    setYear(String(new Date().getFullYear()));
    setHours("0");
  };

  return (
    <>
      <PageHeader title={client.name} subtitle={client.contactName || "Saved client"} />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/clients">
              <ArrowLeft className="mr-1 h-4 w-4" /> All clients
            </Link>
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit details
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive"
            onClick={() => {
              void (async () => {
                const hasHistory = clientDocs.some(
                  (d) => d.kind === "invoice" || d.kind === "receipt" || d.kind === "credit_note",
                );
                const ok = await confirmAction({
                  title: `Delete client “${client.name}”?`,
                  description: hasHistory
                    ? "Their invoices and receipts stay in Documents."
                    : undefined,
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (!ok) return;
                removeClient(client.id);
                toast.success("Client deleted");
                void navigate({ to: "/clients" });
              })();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setMachineOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add machine
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent" />
                {client.email || "—"}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-accent" />
                {client.phone || "—"}
              </p>
              <p className="flex items-center gap-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-accent" />
                {client.address || "—"}
              </p>
              {"notes" in client && typeof client.notes === "string" && client.notes ? (
                <p className="flex items-start gap-2 md:col-span-2">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {client.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card className="border-accent/40 bg-gradient-to-br from-card to-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Lifetime Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{currency(spend)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {clientDocs.length} documents · {fleet.length} machines
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Client 360</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Activity, promised pay, portal link, and cross-sell
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const token = ensurePortalToken(client.portalToken);
                  updateClient(client.id, { ...client, portalToken: token });
                  const url = `${window.location.origin}${portalPath(client.id, token)}`;
                  void navigator.clipboard.writeText(url).then(
                    () => toast.success("Portal link copied"),
                    () => toast.message(url),
                  );
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy portal link
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-promised-pay">Promised pay date</Label>
                <Input
                  id="client-promised-pay"
                  type="date"
                  value={promisedPayDraft}
                  onChange={(e) => setPromisedPayDraft(e.target.value)}
                  onBlur={() => {
                    const next = promisedPayDraft.trim();
                    const prev = client.promisedPayDate ?? "";
                    if (next === prev) return;
                    updateClient(client.id, {
                      ...client,
                      promisedPayDate: next,
                    });
                    toast.success(next ? `Promised pay · ${next}` : "Promised pay cleared");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred payment</Label>
                <Select
                  value={payMethodDraft || "__none__"}
                  onValueChange={(v) => {
                    const next = v === "__none__" ? "" : v;
                    setPayMethodDraft(next);
                    updateClient(client.id, {
                      ...client,
                      preferredPaymentMethod: next,
                    });
                    toast.success(next ? `Preferred · ${next}` : "Preferred payment cleared");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="OMT">OMT</SelectItem>
                    <SelectItem value="Whish">Whish</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {timeline.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeline.map((row) => (
                    <TableRow
                      key={row.key}
                      className={row.doc ? "cursor-pointer hover:bg-muted/40" : undefined}
                      onClick={() => {
                        if (row.doc) openDoc(row.doc);
                      }}
                    >
                      <TableCell className="text-sm">{row.kind}</TableCell>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(row.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{row.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            )}

            {crossSell.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cross-sell · {fleet[0]?.make} {fleet[0]?.model}
                </p>
                <div className="flex flex-wrap gap-2">
                  {crossSell.map((s) => (
                    <Button
                      key={s.partId}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={() => {
                        const p = getPart(s.partId);
                        if (!p) {
                          toast.error(`Part ${s.partNumber} not in inventory`);
                          return;
                        }
                        if (!documentKind) setDocumentKind("quotation");
                        addPart(p, s.qty);
                        setCartOpen(true);
                        toast.success(`Added ${s.partNumber} ×${s.qty}`);
                      }}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {s.partNumber}
                      <span className="text-muted-foreground">· {s.reason}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Accounts receivable</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {statement.invoices.length} open invoice{statement.invoices.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!statement.invoices.length}
                onClick={() => {
                  setPaymentInvoice(statement.invoices[0] ?? null);
                  setPaymentOpen(true);
                }}
              >
                <Banknote className="mr-1 h-3.5 w-3.5" />
                Record payment
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={statement.total <= 0.005}
                onClick={() => setDiscountOpen(true)}
              >
                <Percent className="mr-1 h-3.5 w-3.5" />
                Discount
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canReturn}
                onClick={() => setReturnOpen(true)}
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Return parts
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!statement.invoices.length && statement.creditNotes.length === 0}
                onClick={() => void downloadStatementPdf(client, statement)}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!statement.invoices.length && statement.creditNotes.length === 0}
                onClick={() => {
                  openStatementWhatsApp(client, statement);
                  if (client.promisedPayDate) {
                    toast.message(`Promised pay · ${client.promisedPayDate}`);
                  }
                }}
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                Statement
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!statement.invoices.length}
                onClick={() => {
                  openOverdueWhatsApp(client, statement);
                  if (client.promisedPayDate) {
                    toast.message(`Promised pay · ${client.promisedPayDate}`);
                  } else {
                    toast.message("Overdue WhatsApp opened");
                  }
                }}
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                WhatsApp overdue nudge
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">0–30 days</p>
                <p className="font-semibold">{currency(statement.current)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">31–60 days</p>
                <p className="font-semibold">{currency(statement.days31To60)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">61+ days</p>
                <p className={statusChipClass(statement.days61Plus > 0 ? "danger" : "neutral")}>
                  {currency(statement.days61Plus)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unapplied credit</p>
                <p
                  className={
                    statement.unappliedCredits > 0.005
                      ? "font-semibold text-emerald-700 dark:text-emerald-400"
                      : "font-semibold text-muted-foreground"
                  }
                >
                  {statement.unappliedCredits > 0.005
                    ? `−${currency(statement.unappliedCredits)}`
                    : currency(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net due</p>
                <p className="font-bold text-accent">{currency(statement.netDue)}</p>
                {statement.total > statement.netDue + 0.005 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Invoice AR {currency(statement.total)}
                  </p>
                ) : null}
              </div>
              {statement.refundOwed > 0.005 ? (
                <div>
                  <p className="text-xs text-muted-foreground">Refund owed to client</p>
                  <p className="font-bold text-amber-700 dark:text-amber-400">
                    {currency(statement.refundOwed)}
                  </p>
                </div>
              ) : null}
            </div>
            {statement.unappliedCredits > 0.005 && statement.rows.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <div className="min-w-[140px] flex-1 space-y-1">
                  <Label htmlFor="apply-credit-invoice" className="text-xs text-muted-foreground">
                    Apply unapplied credit
                  </Label>
                  <Select
                    value={applyCreditInvoiceId || undefined}
                    onValueChange={(id) => {
                      setApplyCreditInvoiceId(id);
                      const row = statement.rows.find((r) => r.invoice.id === id);
                      if (row) {
                        setApplyCreditAmount(
                          String(
                            Math.min(statement.unappliedCredits, row.remaining).toFixed(2),
                          ),
                        );
                      }
                    }}
                  >
                    <SelectTrigger id="apply-credit-invoice" className="h-9">
                      <SelectValue placeholder="Open invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {statement.rows.map((row) => (
                        <SelectItem key={row.invoice.id} value={row.invoice.id}>
                          {row.invoice.id} · {currency(row.remaining)} due
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[110px] space-y-1">
                  <Label htmlFor="apply-credit-amount" className="text-xs text-muted-foreground">
                    Amount
                  </Label>
                  <Input
                    id="apply-credit-amount"
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="h-9"
                    value={applyCreditAmount}
                    onChange={(e) => setApplyCreditAmount(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={!applyCreditInvoiceId}
                  onClick={() => {
                    const amount = Number(applyCreditAmount);
                    if (!Number.isFinite(amount) || amount <= 0) {
                      toast.error("Enter a valid amount");
                      return;
                    }
                    try {
                      applyUnappliedCredit({
                        clientId: client.id,
                        clientName: client.name,
                        invoiceId: applyCreditInvoiceId,
                        amount,
                      });
                      toast.success(
                        `Applied ${currency(amount)} credit to ${applyCreditInvoiceId}`,
                      );
                      setApplyCreditInvoiceId("");
                      setApplyCreditAmount("");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not apply credit");
                    }
                  }}
                >
                  Apply credit
                </Button>
              </div>
            ) : null}
            {statement.rows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="w-[1%] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.rows.map((row) => (
                    <TableRow
                      key={row.invoice.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDoc(row.invoice)}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDoc(row.invoice);
                          }}
                        >
                          {row.invoice.id}
                        </button>
                      </TableCell>
                      <TableCell>{row.invoice.date}</TableCell>
                      <TableCell className="text-right text-xs">
                        <span
                          className={statusChipClass(
                            row.bucket === "days61Plus"
                              ? "danger"
                              : row.bucket === "days31To60"
                                ? "warning"
                                : "info",
                          )}
                        >
                          {row.ageDays}d
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {row.credits > 0.005 ? `−${currency(row.credits)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(row.remaining)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentInvoice(row.invoice);
                            setPaymentOpen(true);
                          }}
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          Pay
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            {statement.creditNotes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Credits applied (returns & discounts)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credit</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.creditNotes.map((cn) => {
                      const isDiscount =
                        cn.discountType === "amount" ||
                        cn.lines.some(
                          (l) => l.partNumber === "DISCOUNT" || l.category === "Discount",
                        );
                      return (
                        <TableRow
                          key={cn.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => openDoc(cn)}
                        >
                          <TableCell className="font-mono text-xs">{cn.id}</TableCell>
                          <TableCell>{cn.date}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{isDiscount ? "Discount" : "Return"}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {cn.invoiceId ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            −{currency(cn.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Documents
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Quotations, invoices, receipts, and credit notes — click a row to open
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {clientDocs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No quotations, invoices, receipts, or credit notes for this client yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="w-[1%] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientDocs.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDoc(doc)}
                    >
                      <TableCell className="text-sm">{kindLabel(doc.kind)}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDoc(doc);
                          }}
                        >
                          {doc.id}
                        </button>
                      </TableCell>
                      <TableCell>{doc.paymentDate || doc.date}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(doc.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{doc.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {doc.kind === "receipt" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingReceipt(doc);
                                  setPaymentInvoice(null);
                                  setPaymentOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void (async () => {
                                    const ok = await confirmAction({
                                      title: "Delete receipt?",
                                      description: deleteReceiptConfirmMessage(doc),
                                      confirmLabel: "Delete",
                                      destructive: true,
                                    });
                                    if (!ok) return;
                                    try {
                                      deleteInvoicePayment(doc.id);
                                      toast.success(`Deleted ${doc.id}`);
                                    } catch (err) {
                                      toast.error(
                                        err instanceof Error
                                          ? err.message
                                          : "Failed to delete receipt",
                                      );
                                    }
                                  })();
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Open ${doc.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDoc(doc);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {allOrders.length > 0 && fleet.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOrders.map((o) => {
                    const total = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id}</TableCell>
                        <TableCell>{o.date}</TableCell>
                        <TableCell className="text-sm">
                          {o.lines.map((l) => (
                            <div key={l.partId} className="text-muted-foreground">
                              <span className="font-mono text-xs text-foreground">
                                {l.partNumber}
                              </span>{" "}
                              — {l.name} <span className="text-xs">×{l.qty}</span>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              o.status === "Paid"
                                ? "default"
                                : o.status === "Pending"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5 text-accent" /> Fleet & Order History
          </h2>
          {fleet.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No machines linked yet. Add a machine to organize this client&apos;s fleet.
            </p>
          )}
          {fleet.map((m) => {
            const mOrders = ordersByMachine(m.id);
            const mSpend = mOrders.reduce(
              (s, o) => s + o.lines.reduce((ls, l) => ls + l.qty * l.unitPrice, 0),
              0,
            );
            const matchedKits = kits.filter((kit) => kitMatchesMachine(kit.machine, m.make, m.model));
            return (
              <Card key={m.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {m.make} {m.model}
                    </CardTitle>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Serial {m.serialNumber} · {m.year} · {m.hours.toLocaleString()} hrs
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{currency(mSpend)}</p>
                    <p className="text-xs text-muted-foreground">{mOrders.length} orders</p>
                  </div>
                </CardHeader>
                {matchedKits.length > 0 ? (
                  <CardContent className="border-b border-border pb-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Recommended kits
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchedKits.map((kit) => (
                        <Button
                          key={kit.id}
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (!documentKind) setDocumentKind("quotation");
                            let n = 0;
                            for (const line of kit.lines) {
                              const p = getPart(line.partId);
                              if (p) {
                                addPart(p, line.qty);
                                n += 1;
                              }
                            }
                            setCartOpen(true);
                            toast.success(`Added ${n} parts from “${kit.name}”`);
                          }}
                        >
                          {kit.name} ({kit.lines.length})
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                ) : null}
                <CardContent className="p-0">
                  {mOrders.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No orders linked to this machine yet.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Parts</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mOrders.map((o) => {
                          const total = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                          return (
                            <TableRow key={o.id}>
                              <TableCell className="font-mono text-xs">{o.id}</TableCell>
                              <TableCell>{o.date}</TableCell>
                              <TableCell className="text-sm">
                                {o.lines.map((l) => (
                                  <div key={l.partId} className="text-muted-foreground">
                                    <span className="font-mono text-xs text-foreground">
                                      {l.partNumber}
                                    </span>{" "}
                                    — {l.name} <span className="text-xs">×{l.qty}</span>
                                  </div>
                                ))}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currency(total)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant={
                                    o.status === "Paid"
                                      ? "default"
                                      : o.status === "Pending"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {o.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <RecordPaymentDialog
        open={paymentOpen}
        invoice={paymentInvoice}
        receipt={editingReceipt}
        clientId={client.id}
        clientName={client.name}
        onOpenChange={(open) => {
          setPaymentOpen(open);
          if (!open) {
            setPaymentInvoice(null);
            setEditingReceipt(null);
          }
        }}
        onRecorded={(receipt) => {
          openDoc(receipt);
          toast.success(
            editingReceipt ? `Payment updated · ${receipt.id}` : `Payment recorded · ${receipt.id}`,
          );
        }}
      />

      <ClientDiscountDialog
        open={discountOpen}
        onOpenChange={setDiscountOpen}
        clientId={client.id}
        clientName={client.name}
        onRecorded={(credits) => {
          if (credits[0]) openDoc(credits[0]);
        }}
      />

      <CreateReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        clientId={client.id}
        onRecorded={(creditNote) => {
          openDoc(creditNote);
        }}
      />

      <PartyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        kind="client"
        party={client}
      />

      <PdfPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={preview?.id ?? "Document"}
        blobUrl={preview?.blobUrl ?? null}
        onDownload={() => {
          if (!preview) return;
          void (async () => {
            await downloadSavedDocument(receiptWithBalanceSnapshot(preview.doc, invoices));
            toast.success(`Downloaded ${preview.doc.id}.pdf`);
          })();
        }}
        onShare={() => {
          if (!preview) return;
          void (async () => {
            const result = await shareSavedDocument(
              receiptWithBalanceSnapshot(preview.doc, invoices),
            );
            if (result.cancelled) {
              toast.message("Share cancelled");
              return;
            }
            if (result.shared) {
              toast.success(`Shared ${result.id}.pdf`);
              return;
            }
            toast.success(`Downloaded ${result.id}.pdf — attach the file when sharing`);
          })();
        }}
      />

      <Dialog open={machineOpen} onOpenChange={setMachineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add machine</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Komatsu" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="PC200-7"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Serial</Label>
              <Input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Serial number"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Hours</Label>
              <Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMachineOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveMachine}>
              Save machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
