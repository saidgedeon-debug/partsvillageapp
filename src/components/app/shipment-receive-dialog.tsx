import { useEffect, useMemo, useState } from "react";
import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import { usePreOrders } from "@/components/app/preorders-context";
import {
  useShipments,
  type ChinaShipment,
  type ShipmentLine,
} from "@/components/app/shipments-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localTodayIso } from "@/lib/date-local";
import { allocateLandedCosts } from "@/lib/landed-cost";
import { currency, partNumbersOf, type Part } from "@/lib/mock-data";
import { blendedUnitCost } from "@/lib/part-identity";
import { allocateFreight } from "@/lib/preorders";

function newLineId() {
  return `sl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type ReceiveRow = {
  key: string;
  partId?: string;
  partNumber: string;
  name: string;
  qtyOrdered: number;
  qtyAlreadyReceived: number;
  qtyToReceive: string;
  unitCost?: number;
};

function rowsFromShipment(shipment: ChinaShipment): ReceiveRow[] {
  return (shipment.lines ?? []).map((line) => ({
    key: line.id,
    partId: line.partId,
    partNumber: line.partNumber,
    name: line.name,
    qtyOrdered: line.qtyOrdered,
    qtyAlreadyReceived: line.qtyReceived,
    qtyToReceive: String(Math.max(0, line.qtyOrdered - line.qtyReceived) || ""),
    unitCost: line.unitCost,
  }));
}

export function ShipmentReceiveDialog({
  open,
  onOpenChange,
  shipment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: ChinaShipment | null;
}) {
  const { parts, adjustPartQuantity, getPart, updatePart } = useInventory();
  const { updateShipment } = useShipments();
  const { orders: preOrders } = usePreOrders();
  const [rows, setRows] = useState<ReceiveRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !shipment) return;
    setRows(rowsFromShipment(shipment));
    setSearch("");
  }, [open, shipment]);

  const landedByPartId = useMemo(() => {
    const map = new Map<string, number>();
    if (!shipment?.preOrderId) return map;
    const pre = preOrders.find((o) => o.id === shipment.preOrderId);
    if (!pre) return map;
    const landings = allocateFreight(pre.lines, pre.shipmentCost ?? 0);
    for (const landing of landings) {
      const id = landing.line.partId;
      if (id) map.set(id, landing.landedUnitCost);
    }
    return map;
  }, [shipment, preOrders]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return parts
      .filter((part) => {
        if (rows.some((row) => row.partId === part.id)) return false;
        return (
          partNumbersOf(part).some((n) => n.toLowerCase().includes(q)) ||
          part.name.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [parts, search, rows]);

  const addPart = (part: Part) => {
    setRows((prev) => [
      ...prev,
      {
        key: newLineId(),
        partId: part.id,
        partNumber: part.partNumber,
        name: part.name,
        qtyOrdered: 1,
        qtyAlreadyReceived: 0,
        qtyToReceive: "1",
        unitCost: part.cost,
      },
    ]);
    setSearch("");
  };

  const resolvePartId = (row: ReceiveRow): string | null => {
    if (row.partId && getPart(row.partId)) return row.partId;
    const needle = row.partNumber.trim().toLowerCase();
    if (!needle) return null;
    const hit = parts.find((part) =>
      partNumbersOf(part).some((n) => n.toLowerCase() === needle),
    );
    return hit?.id ?? null;
  };

  const freightTotal = Number(shipment?.freightCost) || 0;
  const customsTotal =
    Number((shipment as { customsCost?: number } | null)?.customsCost) || 0;

  const confirm = () => {
    if (!shipment) return;
    const updates: { row: ReceiveRow; partId: string; qty: number; unitCost?: number }[] = [];
    for (const row of rows) {
      const qty = Math.floor(Number(row.qtyToReceive));
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const partId = resolvePartId(row);
      if (!partId) {
        toast.error(`No inventory match for ${row.partNumber}`);
        return;
      }
      const incoming =
        landedByPartId.get(partId) ??
        (row.unitCost != null && Number.isFinite(row.unitCost) ? row.unitCost : undefined);
      updates.push({ row, partId, qty, unitCost: incoming });
    }
    if (updates.length === 0) {
      toast.error("Enter at least one quantity to receive");
      return;
    }

    const allocations = allocateLandedCosts(
      updates.map((u) => ({
        id: u.row.key,
        qty: u.qty,
        unitCost: u.unitCost ?? 0,
      })),
      freightTotal,
      customsTotal,
    );
    const landedByKey = new Map(allocations.map((a) => [a.id, a.landedUnitCost]));

    for (const { row, partId, qty, unitCost } of updates) {
      const part = getPart(partId);
      const landed = landedByKey.get(row.key) ?? unitCost;
      if (part && landed != null && Number.isFinite(landed) && landed >= 0) {
        const nextCost = blendedUnitCost(part.quantity, part.cost, qty, landed);
        updatePart(partId, { cost: nextCost });
      }
      adjustPartQuantity(partId, qty);
    }

    const byKey = new Map(updates.map((u) => [u.row.key, u]));
    const nextLines: ShipmentLine[] = rows.map((row) => {
      const bump = byKey.get(row.key)?.qty ?? 0;
      const partId = resolvePartId(row) ?? row.partId;
      return {
        id: row.key,
        partId: partId || undefined,
        partNumber: row.partNumber,
        name: row.name,
        qtyOrdered: Math.max(row.qtyOrdered, row.qtyAlreadyReceived + bump),
        qtyReceived: row.qtyAlreadyReceived + bump,
        unitCost: row.unitCost,
      };
    });

    const allDone = nextLines.every((line) => line.qtyReceived >= line.qtyOrdered);
    updateShipment(shipment.id, {
      lines: nextLines,
      stockReceivedAt: new Date().toISOString(),
      arrivedAt: shipment.arrivedAt || localTodayIso(),
      status: allDone || shipment.status === "Arrived" || shipment.status === "In stock"
        ? "In stock"
        : shipment.status,
    });

    const totalQty = updates.reduce((s, u) => s + u.qty, 0);
    toast.success(`Received ${totalQty} unit${totalQty === 1 ? "" : "s"} into stock`);
    onOpenChange(false);
  };

  if (!shipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-muted-foreground" />
            Receive into stock
          </DialogTitle>
          <DialogDescription>
            Choose parts and quantities from “{shipment.title}”. Inventory qty increases
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="receive-search">Add part from inventory</Label>
            <Input
              id="receive-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Part #, OEM, or name…"
            />
            {matches.length > 0 ? (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border">
                {matches.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                    onClick={() => addPart(part)}
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-xs font-semibold">{part.partNumber}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {part.name}
                      </span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No parts on this shipment yet — search above to add what arrived.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_80px_auto]"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold">{row.partNumber}</p>
                    <p className="truncate text-sm text-muted-foreground">{row.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ordered {row.qtyOrdered}
                      {row.qtyAlreadyReceived > 0
                        ? ` · already received ${row.qtyAlreadyReceived}`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Receive</Label>
                    <Input
                      inputMode="numeric"
                      value={row.qtyToReceive}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, qtyToReceive: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="self-end"
                    aria-label="Remove line"
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-3 border-t border-border px-6 py-4 sm:flex-col">
          {freightTotal > 0 ? (
            <p className="text-xs text-muted-foreground">
              Landed costs include freight {currency(freightTotal)} split by value
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm}>
              Post to inventory
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
