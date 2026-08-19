import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Ship, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { InlineNumberCell } from "@/components/app/inline-number-cell";
import { ShipmentFormDialog } from "@/components/app/shipment-form-dialog";
import { useParties } from "@/components/app/parties-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { partDescriptionOf, type Part } from "@/lib/mock-data";

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
  const { askDocumentForPart, setDocumentKind, documentKind, setCartOpen, addPart } = useCart();
  const { suppliers } = useParties();
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [shipmentPart, setShipmentPart] = useState<Part | null>(null);

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

  const shipmentDraft = useMemo(
    () => ({
      title: shipmentPart
        ? `Reorder ${shipmentPart.partNumber}`
        : `Low-stock reorder · ${low.length} SKUs`,
      orderedAt: new Date().toLocaleDateString("en-CA"),
      notes: shipmentPart
        ? `${shipmentPart.partNumber} × ${Math.max(1, shipmentPart.reorderAt - shipmentPart.quantity || 1)}`
        : low
            .slice(0, 80)
            .map((p) => `${p.partNumber} × ${Math.max(1, p.reorderAt - p.quantity || 1)}`)
            .join("\n"),
      status: "Ordered" as const,
      category: "other" as const,
      cargoType: "divers" as const,
      currency: "USD" as const,
    }),
    [low, shipmentPart],
  );
  const fastestLead = suppliers
    .map((s) => s.leadTimeDays)
    .filter((n): n is number => Number.isFinite(n))
    .sort((a, b) => a - b)[0];
  const reorderBy =
    fastestLead != null
      ? new Date(Date.now() + fastestLead * 86_400_000).toLocaleDateString()
      : null;

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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={low.length === 0}
            onClick={() => {
              setShipmentPart(null);
              setShipmentOpen(true);
            }}
          >
            <Ship className="h-3.5 w-3.5" />
            New reorder shipment
          </Button>
          {fastestLead != null ? (
            <span className="text-xs text-muted-foreground">
              Fastest supplier lead time: ~{fastestLead} days · order by {reorderBy}
            </span>
          ) : null}
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
              <EmptyState title="No low-stock parts right now" icon={AlertTriangle} />
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
                  <p className="truncate text-xs text-muted-foreground">{partDescriptionOf(p)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Reorder at {p.reorderAt}
                  </p>
                </div>
                <div className="w-24">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Qty</p>
                  <InlineNumberCell
                    value={p.quantity}
                    ariaLabel={`Edit quantity for ${p.partNumber}`}
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
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() => {
                    setShipmentPart(p);
                    setShipmentOpen(true);
                  }}
                >
                  <Ship className="h-3.5 w-3.5" />
                  Ship
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
      <ShipmentFormDialog
        open={shipmentOpen}
        onOpenChange={setShipmentOpen}
        initialValues={shipmentDraft}
      />
    </>
  );
}
