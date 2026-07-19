import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, ArrowLeft, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { InlineNumberCell } from "@/components/app/inline-number-cell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { partDescriptionOf } from "@/lib/mock-data";

export const Route = createFileRoute("/low-stock")({
  head: () => ({
    meta: [
      { title: "Low stock — Parts Village" },
      { name: "description", content: "Parts at or below reorder point." },
    ],
  }),
  component: LowStockPage,
});

function LowStockPage() {
  const { parts, updatePart, catalogReady } = useInventory();
  const { askDocumentForPart, setDocumentKind, documentKind, setCartOpen, addPart } =
    useCart();

  const low = useMemo(
    () =>
      parts
        .filter((p) => p.reorderAt > 0 && p.quantity <= p.reorderAt)
        .sort((a, b) => a.quantity - b.quantity || a.partNumber.localeCompare(b.partNumber)),
    [parts],
  );

  const addAllToInquiry = () => {
    if (!documentKind) setDocumentKind("inquiry");
    let n = 0;
    for (const p of low.slice(0, 80)) {
      addPart(p, Math.max(1, p.reorderAt - p.quantity || 1));
      n += 1;
    }
    setCartOpen(true);
    toast.success(`Added ${n} low-stock parts to inquiry cart`);
  };

  return (
    <>
      <PageHeader
        title="Low stock"
        subtitle={
          catalogReady
            ? `${low.length} part${low.length === 1 ? "" : "s"} at or below reorder`
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
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={low.length === 0}
            onClick={addAllToInquiry}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Add all to supplier inquiry
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-accent" />
              Reorder queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            {low.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No low-stock parts right now.
              </p>
            )}
            {low.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{p.partNumber}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {p.category}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {partDescriptionOf(p)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Reorder at {p.reorderAt}
                  </p>
                </div>
                <div className="w-24">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Qty</p>
                  <InlineNumberCell
                    value={p.quantity}
                    onCommit={(n) => {
                      updatePart(p.id, { quantity: n });
                      toast.success(`${p.partNumber} qty → ${n}`);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => askDocumentForPart(p)}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Cart
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
