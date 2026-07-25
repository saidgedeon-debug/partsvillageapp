import { createFileRoute, Link } from "@tanstack/react-router";
import { DollarSign, FileText, AlertTriangle, TrendingUp, Package, Users } from "lucide-react";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { useDocuments, invoiceAmountPaid } from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { useShipments } from "@/components/app/shipments-context";
import { usePrefs } from "@/components/app/prefs-context";
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
import { currency } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toUsd } from "@/lib/fx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { parts } = useInventory();
  const { clients } = useParties();
  const { invoices, quotations, receipts } = useDocuments();
  const { orders } = useFleet();
  const { shipments } = useShipments();
  const { rmbPerUsd } = usePrefs();
  const now = new Date();
  const [pnlFrom, setPnlFrom] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const [pnlTo, setPnlTo] = useState(now.toLocaleDateString("en-CA"));

  const paidSales = useMemo(
    () =>
      invoices.reduce((s, i) => s + invoiceAmountPaid(i), 0) +
      orders
        .filter((o) => o.status === "Paid")
        .reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.qty * l.unitPrice, 0), 0),
    [invoices, orders],
  );

  const activeQuotes = useMemo(
    () => quotations.filter((q) => q.status === "Sent" || q.status === "Draft").length,
    [quotations],
  );

  const lowStockParts = useMemo(
    () =>
      parts
        .filter((p) => p.quantity > 0 && p.quantity <= p.reorderAt)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 8),
    [parts],
  );

  const recent = useMemo(() => {
    const invoiceIds = new Set(invoices.map((i) => i.id));
    const fromInvoices = invoices.map((i) => ({
      id: i.id,
      party: i.partyName,
      parts: i.lines.map((l) => l.partNumber).join(", "),
      total: i.total,
      status: i.status,
      date: i.date,
    }));
    // Orders created from checkout use id `ord-${invoiceId}` — skip those duplicates.
    const fromOrders = orders
      .filter((o) => {
        const linkedInvoiceId = o.documentId || (o.id.startsWith("ord-") ? o.id.slice(4) : "");
        return !linkedInvoiceId || !invoiceIds.has(linkedInvoiceId);
      })
      .map((o) => ({
        id: o.id,
        party: clients.find((c) => c.id === o.clientId)?.name ?? "Client",
        parts: o.lines.map((l) => l.partNumber).join(", "),
        total: o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
        status: o.status,
        date: o.date,
      }));
    return [...fromOrders, ...fromInvoices]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 8);
  }, [orders, invoices, clients]);

  const inventoryValue = parts.reduce((s, p) => s + p.cost * p.quantity, 0);
  const priced = parts.filter((p) => p.price > 0 && p.quantity > 0);
  const revenueWeight = priced.reduce((s, p) => s + p.price * p.quantity, 0);
  const avgMargin =
    revenueWeight === 0
      ? 0
      : Math.round(
          (priced.reduce((s, p) => s + (p.price - p.cost) * p.quantity, 0) / revenueWeight) * 100,
        );

  const pnl = useMemo(() => {
    const inRange = (date: string) => date >= pnlFrom && date <= pnlTo;
    const rangeReceipts = receipts.filter((receipt) => inRange(receipt.date));
    const receiptInvoiceIds = new Set(receipts.map((receipt) => receipt.invoiceId).filter(Boolean));
    const collectedByInvoice = new Map<string, number>();
    for (const receipt of rangeReceipts) {
      if (!receipt.invoiceId) continue;
      collectedByInvoice.set(
        receipt.invoiceId,
        (collectedByInvoice.get(receipt.invoiceId) ?? 0) + receipt.total,
      );
    }
    const receiptSales = rangeReceipts.reduce((s, receipt) => s + receipt.total, 0);
    const legacyPaidInvoices = invoices
      .filter((invoice) => inRange(invoice.date))
      .filter((invoice) => !receiptInvoiceIds.has(invoice.id))
      .filter((invoice) => invoiceAmountPaid(invoice) > 0);
    const legacyPaidSales = legacyPaidInvoices.reduce(
      (sum, invoice) => sum + invoiceAmountPaid(invoice),
      0,
    );
    const sales = receiptSales + legacyPaidSales;
    const soldInvoices = invoices.filter(
      (invoice) =>
        (collectedByInvoice.get(invoice.id) ?? 0) > 0 ||
        legacyPaidInvoices.some((legacy) => legacy.id === invoice.id),
    );
    const costById = new Map(parts.map((part) => [part.id, part.cost]));
    const cogs = soldInvoices.reduce((sum, invoice) => {
      const collected =
        collectedByInvoice.get(invoice.id) ??
        (legacyPaidInvoices.some((legacy) => legacy.id === invoice.id)
          ? invoiceAmountPaid(invoice)
          : 0);
      const paidRatio = invoice.total > 0 ? Math.min(1, collected / invoice.total) : 0;
      return (
        sum +
        invoice.lines.reduce(
          (lineSum, line) => lineSum + line.qty * (line.unitCost || costById.get(line.partId) || 0),
          0,
        ) *
          paidRatio
      );
    }, 0);
    const freight = shipments
      .filter((shipment) => inRange(shipment.orderedAt))
      .reduce(
        (sum, shipment) =>
          sum +
          toUsd(
            shipment.freightCost ?? 0,
            shipment.freightCurrency ?? shipment.currency,
            rmbPerUsd,
          ),
        0,
      );
    return { sales, cogs, freight, net: sales - cogs - freight };
  }, [receipts, invoices, parts, shipments, rmbPerUsd, pnlFrom, pnlTo]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          isSupabaseConfigured
            ? "Live from Supabase · synced across every device in real time"
            : "Offline — connect Supabase to load live data"
        }
      />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overview
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Paid Sales" value={currency(paidSales)} icon={DollarSign} accent />
            <MetricCard label="Active Quotes" value={String(activeQuotes)} icon={FileText} />
            <MetricCard
              label="Low Stock Alerts"
              value={String(lowStockParts.length)}
              icon={AlertTriangle}
              warn
            />
            <MetricCard label="Clients" value={`${clients.length} saved`} icon={Users} />
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Profit &amp; loss
          </p>
          <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Simple P&amp;L</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Collected sales minus invoice COGS and shipment freight
              </p>
            </div>
            <div className="flex gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={pnlFrom} onChange={(e) => setPnlFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={pnlTo} onChange={(e) => setPnlTo(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Collected sales</p>
              <p className="text-xl font-semibold">{currency(pnl.sales)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">COGS</p>
              <p className="text-xl font-semibold">{currency(pnl.cogs)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Freight</p>
              <p className="text-xl font-semibold">{currency(pnl.freight)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net</p>
              <p
                className={`text-xl font-bold ${pnl.net >= 0 ? "text-foreground" : "text-destructive"}`}
              >
                {currency(pnl.net)}
              </p>
            </div>
          </CardContent>
        </Card>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent activity
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Recent invoices & orders
              </CardTitle>
              <Link
                to="/documents"
                search={{ tab: "invoices" }}
                className="text-xs font-medium text-primary hover:underline"
              >
                View documents →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id}</TableCell>
                      <TableCell>{o.party}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {o.parts || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(o.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            o.status === "Paid"
                              ? "default"
                              : o.status === "Pending" || o.status === "Unpaid"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {o.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recent.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No invoices or orders yet — finish a checkout from the cart.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-accent" />
                Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockParts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No low-stock parts (qty above reorder, or still at 0).
                </p>
              )}
              {lowStockParts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {p.partNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-accent">{p.quantity}</p>
                    <p className="text-xs uppercase text-muted-foreground">
                      of {p.reorderAt} min
                    </p>
                  </div>
                </div>
              ))}
              <Link
                to="/inventory"
                className="block pt-1 text-xs font-medium text-primary hover:underline"
              >
                Manage inventory →
              </Link>
            </CardContent>
          </Card>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Catalog
          </p>
          <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Parts Catalog</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{parts.length}</span>
              <span className="text-xs text-muted-foreground">SKUs tracked</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Inventory Value</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{currency(inventoryValue)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Margin (avg)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-primary">
              {priced.length ? `${avgMargin}%` : "—"}
            </CardContent>
          </Card>
          </div>
        </section>
      </main>
    </>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  warn,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <Card className={accent ? "border-accent/40 bg-gradient-to-br from-card to-accent/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className={`h-4 w-4 ${warn ? "text-accent" : accent ? "text-accent" : "text-primary"}`}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
