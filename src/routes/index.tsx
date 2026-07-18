import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { DollarSign, FileText, AlertTriangle, TrendingUp, Package, Users } from "lucide-react";
import type { ComponentType } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  totalSales,
  activeQuotesCount,
  lowStockParts,
  currency,
  orders,
  clientById,
  partById,
  parts,
  clients,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const recent = [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Operations overview" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Sales (YTD)" value={currency(totalSales)} icon={DollarSign} accent />
          <MetricCard label="Active Quotes" value={String(activeQuotesCount)} icon={FileText} />
          <MetricCard label="Low Stock Alerts" value={String(lowStockParts.length)} icon={AlertTriangle} warn />
          <MetricCard label="Fleet Under Service" value={`${clients.length} clients`} icon={Users} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-accent" />Recent Orders</CardTitle>
              <Link to="/clients" className="text-xs font-medium text-accent hover:underline">View clients →</Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((o) => {
                    const total = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id.toUpperCase()}</TableCell>
                        <TableCell>{clientById(o.clientId)?.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {o.lines.map((l) => partById(l.partId)?.partNumber).join(", ")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{currency(total)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={o.status === "Paid" ? "default" : o.status === "Pending" ? "secondary" : "outline"}>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-accent" />Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockParts.length === 0 && <p className="text-sm text-muted-foreground">All stock healthy.</p>}
              {lowStockParts.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{p.partNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-accent">{p.quantity}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">of {p.reorderAt} min</p>
                  </div>
                </div>
              ))}
              <Link to="/inventory" className="block pt-1 text-xs font-medium text-accent hover:underline">
                Manage inventory →
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Parts Catalog</CardTitle></CardHeader>
            <CardContent className="flex items-baseline gap-2"><Package className="h-5 w-5 text-accent" /><span className="text-2xl font-bold">{parts.length}</span><span className="text-xs text-muted-foreground">SKUs tracked</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Inventory Value</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{currency(parts.reduce((s, p) => s + p.cost * p.quantity, 0))}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Margin (avg)</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold text-accent">
              {Math.round((parts.reduce((s, p) => s + (p.price - p.cost) / p.price, 0) / parts.length) * 100)}%
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function MetricCard({
  label, value, icon: Icon, accent, warn,
}: { label: string; value: string; icon: ComponentType<{ className?: string }>; accent?: boolean; warn?: boolean }) {
  return (
    <Card className={accent ? "border-accent/40 bg-gradient-to-br from-card to-accent/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${warn ? "text-accent" : accent ? "text-accent" : "text-primary"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
