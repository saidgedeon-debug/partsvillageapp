import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, Package } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parts, currency } from "@/lib/mock-data";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Parts Village" },
      { name: "description", content: "Stock levels, cost, selling price and machine compatibility for every part in the catalog." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { query } = useSearch();
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!q) return parts;
    return parts.filter(
      (p) =>
        p.partNumber.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.compatibility.some((c) => c.toLowerCase().includes(q)),
    );
  }, [q]);

  return (
    <>
      <PageHeader title="Stock / Inventory" subtitle={`${rows.length} of ${parts.length} parts`} />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-accent" /> Parts Catalog
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Total value:{" "}
              <span className="font-semibold text-foreground">
                {currency(parts.reduce((s, p) => s + p.cost * p.quantity, 0))}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Compatible With</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const low = p.quantity <= p.reorderAt;
                  const margin = Math.round(((p.price - p.cost) / p.price) * 100);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.partNumber}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center gap-1 font-semibold ${low ? "text-accent" : ""}`}>
                          {low && <AlertTriangle className="h-3.5 w-3.5" />}
                          {p.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{currency(p.cost)}</TableCell>
                      <TableCell className="text-right font-semibold">{currency(p.price)}</TableCell>
                      <TableCell className="text-right text-accent">{margin}%</TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {p.compatibility.join(" · ")}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No parts match “{query}”.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}