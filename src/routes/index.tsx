import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DollarSign,
  FileText,
  AlertTriangle,
  TrendingUp,
  Package,
  Wallet,
  Clock,
  MessageCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { useDocuments, invoiceAmountPaid, invoiceCredits, receiptAffectsBalance } from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { useShipments } from "@/components/app/shipments-context";
import { usePrefs } from "@/components/app/prefs-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildClientsArQueue } from "@/lib/ar-statement";
import { computeDrawerExpected } from "@/lib/drawer-radar";
import { buildMarginRadar } from "@/lib/margin-radar";
import { currency } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toUsd } from "@/lib/fx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/")({
  component: Index,
});

function daysAgo(isoDate: string): number {
  const then = new Date(`${isoDate}T12:00:00`);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

function Index() {
  const { parts } = useInventory();
  const { clients } = useParties();
  const { invoices, quotations, receipts, creditNotes, inquiries, documents } = useDocuments();
  const { orders } = useFleet();
  const { shipments } = useShipments();
  const { rmbPerUsd, priceBooks } = usePrefs();
  const now = new Date();
  const [pnlFrom, setPnlFrom] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const [pnlTo, setPnlTo] = useState(now.toLocaleDateString("en-CA"));

  const paidSales = useMemo(() => {
    const invoiceIds = new Set(invoices.map((i) => i.id));
    const invoicePaid = invoices.reduce((s, i) => s + invoiceAmountPaid(i), 0);
    const unmatchedPaidOrders = orders
      .filter((o) => {
        if (o.status !== "Paid") return false;
        const linkedInvoiceId = o.documentId || (o.id.startsWith("ord-") ? o.id.slice(4) : "");
        return !linkedInvoiceId || !invoiceIds.has(linkedInvoiceId);
      })
      .reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.qty * l.unitPrice, 0), 0);
    return invoicePaid + unmatchedPaidOrders;
  }, [invoices, orders]);

  const activeQuotes = useMemo(
    () => quotations.filter((q) => q.status === "Sent" || q.status === "Draft").length,
    [quotations],
  );

  const followUpQuotes = useMemo(
    () =>
      quotations
        .filter((q) => q.status === "Sent" || q.status === "Draft")
        .map((q) => ({ ...q, age: daysAgo(q.date) }))
        .filter((q) => q.age >= 7)
        .sort((a, b) => b.age - a.age)
        .slice(0, 8),
    [quotations],
  );

  const staleInquiries = useMemo(
    () =>
      inquiries
        .filter((inq) => inq.status === "Open")
        .map((inq) => ({ ...inq, age: daysAgo(inq.date) }))
        .filter((inq) => inq.age >= 7)
        .sort((a, b) => b.age - a.age)
        .slice(0, 8),
    [inquiries],
  );

  const monthlySales = useMemo(() => {
    const buckets = new Map<string, number>();
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, 0);
    }
    for (const receipt of receipts) {
      if (receipt.invoiceId && !receiptAffectsBalance(receipt)) continue;
      const key = receipt.date.slice(0, 7);
      if (!buckets.has(key)) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + receipt.total);
    }
    return [...buckets.entries()].map(([month, total]) => ({
      month: month.slice(5),
      total: Math.round(total * 100) / 100,
    }));
  }, [receipts]);

  const topClients = useMemo(() => {
    const spend = new Map<string, number>();
    for (const inv of invoices) {
      const name = inv.partyName || "Unknown";
      spend.set(name, (spend.get(name) ?? 0) + invoiceAmountPaid(inv));
    }
    return [...spend.entries()]
      .map(([name, total]) => ({ name, total }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [invoices]);

  const lowStockParts = useMemo(
    () =>
      parts
        .filter((p) => p.quantity > 0 && p.quantity <= p.reorderAt)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 8),
    [parts],
  );

  const drawer = useMemo(() => computeDrawerExpected(documents), [documents]);
  const drawerTotal = drawer.cash + drawer.omt + drawer.whish;

  const arQueue = useMemo(
    () => buildClientsArQueue(clients, invoices, creditNotes),
    [clients, invoices, creditNotes],
  );
  const arTotal = useMemo(
    () => arQueue.reduce((sum, row) => sum + row.statement.netDue, 0),
    [arQueue],
  );
  const arUnappliedTotal = useMemo(
    () => arQueue.reduce((sum, row) => sum + row.statement.unappliedCredits, 0),
    [arQueue],
  );
  const arAging = useMemo(() => {
    let current = 0;
    let days31To60 = 0;
    let days61Plus = 0;
    for (const row of arQueue) {
      current += row.statement.current;
      days31To60 += row.statement.days31To60;
      days61Plus += row.statement.days61Plus;
    }
    return [
      { bucket: "0–30", total: Math.round(current * 100) / 100 },
      { bucket: "31–60", total: Math.round(days31To60 * 100) / 100 },
      { bucket: "61+", total: Math.round(days61Plus * 100) / 100 },
    ];
  }, [arQueue]);

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

  const marginRadar = useMemo(() => buildMarginRadar(parts, invoices), [parts, invoices]);

  const priceBookAlerts = useMemo(() => {
    const latest = priceBooks[0];
    if (!latest?.rows?.length) return [];
    const byId = new Map(parts.map((p) => [p.id, p]));
    const alerts: Array<{
      partId: string;
      partNumber: string;
      name: string;
      price: number;
      bookCost: number;
    }> = [];
    for (const row of latest.rows) {
      const part = byId.get(row.partId);
      if (!part || !(part.price > 0) || !(row.cost > 0)) continue;
      if (part.price + 0.005 < row.cost) {
        alerts.push({
          partId: part.id,
          partNumber: part.partNumber,
          name: part.name,
          price: part.price,
          bookCost: row.cost,
        });
      }
    }
    return alerts.slice(0, 8);
  }, [priceBooks, parts]);

  const pnl = useMemo(() => {
    const inRange = (date: string) => date >= pnlFrom && date <= pnlTo;
    const cashReceipts = receipts.filter(
      (receipt) => inRange(receipt.date) && (!receipt.invoiceId || receiptAffectsBalance(receipt)),
    );
    const collectedByInvoice = new Map<string, number>();
    for (const receipt of cashReceipts) {
      if (!receipt.invoiceId) continue;
      collectedByInvoice.set(
        receipt.invoiceId,
        (collectedByInvoice.get(receipt.invoiceId) ?? 0) + receipt.total,
      );
    }
    const receiptSales = cashReceipts.reduce((s, receipt) => s + receipt.total, 0);
    const invoicesWithAffectingReceipt = new Set(
      receipts
        .filter((receipt) => receipt.invoiceId && receiptAffectsBalance(receipt))
        .map((receipt) => receipt.invoiceId as string),
    );
    const legacyPaidInvoices = invoices
      .filter((invoice) => inRange(invoice.date))
      .filter((invoice) => !invoicesWithAffectingReceipt.has(invoice.id))
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
    const restockedByInvoicePart = new Map<string, number>();
    for (const note of creditNotes) {
      if (note.kind !== "credit_note" || !note.invoiceId) continue;
      const restockedIds = note.restockedPartIds
        ? new Set(note.restockedPartIds)
        : note.stockRestocked
          ? null
          : new Set<string>();
      if (restockedIds && restockedIds.size === 0) continue;
      for (const line of note.lines) {
        if (!line.partId || line.category === "Payment" || line.category === "Discount") continue;
        if (restockedIds && !restockedIds.has(line.partId)) continue;
        const key = `${note.invoiceId}:${line.partId}`;
        restockedByInvoicePart.set(
          key,
          (restockedByInvoicePart.get(key) ?? 0) + (Number.isFinite(line.qty) ? line.qty : 0),
        );
      }
    }
    const cogs = soldInvoices.reduce((sum, invoice) => {
      const soldByPart = new Map<string, { qty: number; cost: number }>();
      for (const line of invoice.lines) {
        if (!line.partId || line.category === "Payment" || line.category === "Discount") continue;
        const qty = Number.isFinite(line.qty) ? line.qty : 0;
        const unitCost = line.unitCost || costById.get(line.partId) || 0;
        const prev = soldByPart.get(line.partId) ?? { qty: 0, cost: 0 };
        soldByPart.set(line.partId, {
          qty: prev.qty + qty,
          cost: prev.cost + qty * unitCost,
        });
      }
      let invoiceCogs = 0;
      for (const [partId, sold] of soldByPart) {
        const restocked = restockedByInvoicePart.get(`${invoice.id}:${partId}`) ?? 0;
        const netQty = Math.max(0, sold.qty - restocked);
        const unitCost = sold.qty > 0 ? sold.cost / sold.qty : 0;
        invoiceCogs += netQty * unitCost;
      }
      const collectedInRange =
        collectedByInvoice.get(invoice.id) ??
        (legacyPaidInvoices.some((legacy) => legacy.id === invoice.id)
          ? invoiceAmountPaid(invoice)
          : 0);
      const credits = invoiceCredits(invoice, creditNotes);
      const netTotal = Math.max(0, invoice.total - credits);
      const paidRatio =
        netTotal > 0 ? Math.min(1, Math.max(0, collectedInRange / netTotal)) : 0;
      return sum + invoiceCogs * paidRatio;
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
  }, [receipts, invoices, creditNotes, parts, shipments, rmbPerUsd, pnlFrom, pnlTo]);

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
            <MetricCard label="Lifetime collected" value={currency(paidSales)} icon={DollarSign} accent />
            <MetricCard label="Active Quotes" value={String(activeQuotes)} icon={FileText} />
            <MetricCard
              label="Low Stock Alerts"
              value={String(lowStockParts.length)}
              icon={AlertTriangle}
              warn
            />
            <MetricCard
              label="Net AR"
              value={arQueue.length === 0 ? "All clear" : currency(arTotal)}
              hint={
                arQueue.length === 0
                  ? "No open balances"
                  : arUnappliedTotal > 0.005
                    ? `${arQueue.length} client${arQueue.length === 1 ? "" : "s"} · credit −${currency(arUnappliedTotal)}`
                    : `${arQueue.length} client${arQueue.length === 1 ? "" : "s"}`
              }
              icon={Wallet}
              warn={arQueue.length > 0}
              to="/clients"
              search={{ owed: true }}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live drawer · {drawer.date}
            </p>
            <div className="flex gap-3 text-xs">
              <Link to="/insights" className="font-medium text-primary hover:underline">
                Weekly board →
              </Link>
              <Link to="/collections" className="font-medium text-primary hover:underline">
                Chase AR →
              </Link>
              <Link to="/daily-close" className="font-medium text-primary hover:underline">
                Daily close →
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{currency(drawer.cash)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">OMT</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{currency(drawer.omt)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Whish</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{currency(drawer.whish)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Expected today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{currency(drawerTotal)}</p>
                <p className="text-xs text-muted-foreground">
                  {drawer.receiptCount} cash-drawer receipt
                  {drawer.receiptCount === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {followUpQuotes.length > 0 ? (
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quotes to follow up
            </p>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Open quotes · 7+ days
                </CardTitle>
                <Link
                  to="/documents"
                  search={{ tab: "quotations" }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  All quotations →
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {followUpQuotes.map((q) => {
                  const client = clients.find(
                    (c) => c.id === q.partyId || c.name === q.partyName,
                  );
                  const phone = (client?.phone ?? "").replace(/\D/g, "");
                  const text = `Following up on quotation ${q.id} for ${currency(q.total)}`;
                  const waUrl = `${phone ? `https://wa.me/${phone}` : "https://wa.me/"}?text=${encodeURIComponent(text)}`;
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold">{q.id}</p>
                        <p className="truncate text-sm">{q.partyName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold">{currency(q.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.age}d · {q.status}
                          </p>
                        </div>
                        <Button type="button" size="sm" variant="outline" className="gap-1" asChild>
                          <a href={waUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {staleInquiries.length > 0 ? (
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Supplier follow-up
            </p>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Open inquiries · 7+ days
                </CardTitle>
                <Link
                  to="/documents"
                  search={{ tab: "inquiries" }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  All inquiries →
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {staleInquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold">{inq.id}</p>
                      <p className="truncate text-sm">{inq.partyName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{currency(inq.total)}</p>
                      <p className="text-xs text-muted-foreground">{inq.age}d open</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Money radar
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top profit parts · this month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {marginRadar.topProfitParts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No paid sales with margin yet</p>
                ) : (
                  marginRadar.topProfitParts.map((row) => (
                    <div
                      key={row.partId}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold">{row.partNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.name}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        {currency(row.profit)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dead stock · 180d+</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {marginRadar.deadStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stale stock flagged</p>
                ) : (
                  marginRadar.deadStock.map(({ part, daysSinceSale }) => (
                    <div
                      key={part.id}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold">{part.partNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{part.name}</p>
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {daysSinceSale == null ? "Never sold" : `${daysSinceSale}d`} · qty{" "}
                        {part.quantity}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Zero-cost but priced</CardTitle>
                <Badge variant="secondary">{marginRadar.zeroCostPriced.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {marginRadar.zeroCostPriced.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All priced parts have a cost</p>
                ) : (
                  marginRadar.zeroCostPriced.map((part) => (
                    <div
                      key={part.id}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold">{part.partNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{part.name}</p>
                      </div>
                      <p className="shrink-0 text-sm">{currency(part.price)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Negative margin sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {marginRadar.negativeMarginSales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No underwater lines found</p>
                ) : (
                  marginRadar.negativeMarginSales.map((row) => (
                    <div
                      key={`${row.invoiceId}-${row.partNumber}-${row.date}`}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold">{row.partNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.invoiceId} · {row.date}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-destructive">
                        {currency(row.margin)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {priceBookAlerts.length > 0 ? (
            <Card className="border-amber-500/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Price below supplier book cost
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Latest book: {priceBooks[0]?.name}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {priceBookAlerts.map((row) => (
                  <div
                    key={row.partId}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold">{row.partNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.name}</p>
                    </div>
                    <p className="shrink-0 text-xs">
                      sell {currency(row.price)} &lt; book {currency(row.bookCost)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </section>

        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Trends
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Collected by month</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={48} />
                    <Tooltip formatter={(value: number) => currency(value)} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top clients (collected)</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                {topClients.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No paid sales yet
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topClients} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => currency(value)} />
                      <Bar dataKey="total" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">AR aging (open invoices)</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                {arTotal <= 0.005 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No open receivables
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={arAging}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={48} />
                      <Tooltip formatter={(value: number) => currency(value)} />
                      <Bar dataKey="total" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
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
  hint,
  icon: Icon,
  accent,
  warn,
  to,
  search,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  accent?: boolean;
  warn?: boolean;
  to?: string;
  search?: Record<string, unknown>;
}) {
  const inner = (
    <Card
      className={cn(
        accent ? "border-accent/40 bg-gradient-to-br from-card to-accent/5" : "",
        to ? "transition hover:border-primary/40 hover:shadow-md" : "",
      )}
    >
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
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );

  if (!to) return inner;
  return (
    <Link to={to} search={search} className="block">
      {inner}
    </Link>
  );
}
