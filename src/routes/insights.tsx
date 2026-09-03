import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currency } from "@/lib/mock-data";
import { buildWeeklySalesBoard } from "@/lib/sales-board";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Sales board — Parts Village" },
      { name: "description", content: "Top movers, margin winners, and dead stock this week." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { parts } = useInventory();
  const { invoices } = useDocuments();
  const board = useMemo(() => buildWeeklySalesBoard(parts, invoices), [parts, invoices]);

  return (
    <>
      <PageHeader
        title="What sold this week"
        subtitle={`${board.from} → ${board.to} · revenue ${currency(board.revenue)} · margin ${currency(board.margin)}`}
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-accent" />
                Top movers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.topMovers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No invoice lines this week yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    board.topMovers.map((r) => (
                      <TableRow key={r.partId}>
                        <TableCell>
                          <div className="font-mono text-xs">{r.partNumber}</div>
                          <div className="text-xs text-muted-foreground">{r.name}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{r.qtySold}</TableCell>
                        <TableCell className="text-right">{currency(r.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Margin winners</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.marginWinners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground">
                        No margin data this week.
                      </TableCell>
                    </TableRow>
                  ) : (
                    board.marginWinners.map((r) => (
                      <TableRow key={r.partId}>
                        <TableCell>
                          <div className="font-mono text-xs">{r.partNumber}</div>
                          <div className="text-xs text-muted-foreground">{r.name}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-accent">
                          {currency(r.margin)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dead stock (60+ days / never sold)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Days quiet</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.deadStock.map(({ part, daysSinceSale }) => (
                  <TableRow key={part.id}>
                    <TableCell>
                      <div className="font-mono text-xs">{part.partNumber}</div>
                      <div className="text-xs text-muted-foreground">{part.name}</div>
                    </TableCell>
                    <TableCell className="text-right">{part.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {daysSinceSale == null ? "Never" : `${daysSinceSale}d`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/inventory"
                        className="text-xs text-accent underline-offset-2 hover:underline"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
