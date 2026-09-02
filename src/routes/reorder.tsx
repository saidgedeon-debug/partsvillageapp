import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildReorderSuggestions } from "@/lib/demand-forecast";

export const Route = createFileRoute("/reorder")({
  head: () => ({
    meta: [
      { title: "Reorder suggestions — Parts Village" },
      {
        name: "description",
        content: "Low-stock and velocity-based reorder candidates for pre-orders.",
      },
    ],
  }),
  component: ReorderPage,
});

function ReorderPage() {
  const { parts, catalogReady } = useInventory();
  const { invoices } = useDocuments();

  const suggestions = useMemo(
    () => buildReorderSuggestions(parts, invoices),
    [parts, invoices],
  );

  return (
    <>
      <PageHeader
        title="Reorder suggestions"
        subtitle={
          catalogReady
            ? `${suggestions.length} part${suggestions.length === 1 ? "" : "s"} to consider`
            : "Loading catalog…"
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/inventory">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to inventory
            </Link>
          </Button>
          <Button asChild type="button" size="sm" className="gap-1.5">
            <Link
              to="/pre-orders"
              onClick={() =>
                toast.message("Create pre-order manually from these part numbers")
              }
            >
              <PackagePlus className="h-3.5 w-3.5" />
              Open pre-orders
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="h-4 w-4 text-muted-foreground" />
              Suggested reorders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {suggestions.length === 0 ? (
              <EmptyState title="No reorder suggestions right now" icon={PackagePlus} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Reorder at</TableHead>
                    <TableHead className="text-right">Avg/mo</TableHead>
                    <TableHead className="text-right">Suggest qty</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map(({ part, demand, reason }) => (
                    <TableRow key={part.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {part.partNumber}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-sm">
                        {part.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{part.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{part.reorderAt}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {demand.avgPerMonth}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums">
                          {demand.suggestedReorderQty || Math.max(1, part.reorderAt - part.quantity)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[14rem] text-xs text-muted-foreground">
                        {reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
