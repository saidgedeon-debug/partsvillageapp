import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
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
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { RecordPaymentDialog } from "@/components/app/record-payment-dialog";
import { useParties } from "@/components/app/parties-context";
import { useFleet } from "@/components/app/fleet-context";
import {
  invoiceAmountPaid,
  useDocuments,
  type SavedDocument,
} from "@/components/app/documents-context";
import { PartyFormDialog } from "@/components/app/party-form-dialog";
import { PdfPreviewDialog } from "@/components/app/pdf-preview-dialog";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clientById, currency } from "@/lib/mock-data";
import {
  buildArStatement,
  downloadStatementPdf,
  openOverdueWhatsApp,
  openStatementWhatsApp,
} from "@/lib/ar-statement";
import { openSavedDocument, downloadSavedDocument, shareSavedDocument } from "@/lib/document-export";
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
  const { clients } = useParties();
  const { quotations, invoices, receipts, creditNotes } = useDocuments();
  const { machinesByClient, ordersByClient, ordersByMachine, addMachine } = useFleet();
  const [editOpen, setEditOpen] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<SavedDocument | null>(null);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [hours, setHours] = useState("0");
  const [preview, setPreview] = useState<{
    id: string;
    blobUrl: string;
    doc: SavedDocument;
  } | null>(null);

  const client = clients.find((c) => c.id === clientId) ?? clientById(clientId);

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

  const openDoc = (doc: SavedDocument) => {
    const enriched =
      doc.kind === "receipt" && doc.invoiceId
        ? (() => {
            const inv = invoices.find((i) => i.id === doc.invoiceId);
            if (!inv) return doc;
            return {
              ...doc,
              invoiceTotal: inv.total,
              amountPaidAfter: invoiceAmountPaid(inv),
            } as SavedDocument & { invoiceTotal: number; amountPaidAfter: number };
          })()
        : doc;
    const { id, blobUrl } = openSavedDocument(enriched);
    setPreview({ id, blobUrl, doc });
  };

  if (!client) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Client not found.</p>
        <Link to="/clients" className="text-accent hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const fleet = machinesByClient(client.id);
  const allOrders = ordersByClient(client.id);
  const statement = buildArStatement(client.id, invoices, creditNotes);
  const docSpend = clientDocs
    .filter((d) => d.kind === "invoice" || d.kind === "receipt")
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  const fleetSpend = allOrders.reduce(
    (s, o) => s + o.lines.reduce((ls, l) => ls + l.qty * l.unitPrice, 0),
    0,
  );
  const spend = Math.max(docSpend, fleetSpend);

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
                disabled={!statement.invoices.length}
                onClick={() => downloadStatementPdf(client, statement)}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!statement.invoices.length}
                onClick={() => openStatementWhatsApp(client, statement)}
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                Statement
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!statement.invoices.length}
                onClick={() => openOverdueWhatsApp(client, statement)}
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                Overdue WhatsApp
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
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
                <p className="text-xs text-muted-foreground">Total due</p>
                <p className="font-bold text-accent">{currency(statement.total)}</p>
              </div>
            </div>
            {statement.rows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Age</TableHead>
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
                    <TableHead className="w-12" />
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
                      <TableCell>{doc.date}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(doc.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{doc.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
        clientId={client.id}
        clientName={client.name}
        onOpenChange={(open) => {
          setPaymentOpen(open);
          if (!open) setPaymentInvoice(null);
        }}
        onRecorded={(receipt) => {
          openDoc(receipt);
          toast.success(`Payment recorded · ${receipt.id}`);
        }}
      />

      <PartyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        kind="client"
        party={
          "contactName" in client
            ? (client as {
                id: string;
                name: string;
                contactName: string;
                email: string;
                phone: string;
                address: string;
                notes?: string;
              })
            : null
        }
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
          downloadSavedDocument(preview.doc);
          toast.success(`Downloaded ${preview.doc.id}.pdf`);
        }}
        onShare={() => {
          if (!preview) return;
          void (async () => {
            const result = await shareSavedDocument(preview.doc);
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
