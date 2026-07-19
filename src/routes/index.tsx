import { createFileRoute, Link } from "@tanstack/react-router";
import { DollarSign, FileText, AlertTriangle, TrendingUp, Package, Users } from "lucide-react";
import type { ComponentType } from "react";
import { useMemo } from "react";

import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
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

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { parts } = useInventory();
  const { clients } = useParties();
  const { invoices, quotations } = useDocuments();
  const { orders } = useFleet();

  const paidSales = useMemo(
    () =>
      invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.total, 0) +
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
    const fromOrders = orders.map((o) => ({
      id: o.id,
      party: clients.find((c) => c.id === o.clientId)?.name ?? "Client",
      parts: o.lines.map((l) => l.partNumber).join(", "),
      total: o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
      status: o.status,
      date: o.date,
    }));
    const fromInvoices = invoices.map((i) => ({
      id: i.id,
      party: i.partyName,
      parts: i.lines.map((l) => l.partNumber).join(", "),
      total: i.total,
      status: i.status,
      date: i.date,
    }));
    return [...fromOrders, ...fromInvoices]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [orders, invoices, clients]);

  const inventoryValue = parts.reduce((s, p) => s + p.cost * p.quantity, 0);
  const priced = parts.filter((p) => p.price > 0);
  const avgMargin =
    priced.length === 0
      ? 0
      : Math.round(
          (priced.reduce((s, p) => s + (p.price - p.cost) / p.price, 0) / priced.length) * 100,
        );

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

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-accent" />
                Recent invoices & orders
              </CardTitle>
              <Link to="/documents" className="text-xs font-medium text-accent hover:underline">
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
                    <p className="text-[10px] uppercase text-muted-foreground">
                      of {p.reorderAt} min
                    </p>
                  </div>
                </div>
              ))}
              <Link
                to="/inventory"
                className="block pt-1 text-xs font-medium text-accent hover:underline"
              >
                Manage inventory →
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Parts Catalog</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline gap-2">
              <Package className="h-5 w-5 text-accent" />
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
            <CardContent className="text-2xl font-bold text-accent">
              {priced.length ? `${avgMargin}%` : "—"}
            </CardContent>
          </Card>
        </div>
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
