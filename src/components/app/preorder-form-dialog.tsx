import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import { PartySearchPicker } from "@/components/app/party-search-picker";
import { usePreOrders } from "@/components/app/preorders-context";
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
import { currency, partNumbersOf, type Part } from "@/lib/mock-data";
import {
  allocateFreight,
  goodsCostTotal,
  linesTotal,
  type CustomerPreOrder,
  type PreOrderLine,
} from "@/lib/preorders";

type DraftLine = {
  key: string;
  partId: string;
  partNumber: string;
  name: string;
  qty: string;
  unitPrice: string;
  unitCost: string;
  /** True when the line came from the catalog (part # / name locked). */
  catalog: boolean;
};

function newDraftKey() {
  return `nl-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: CustomerPreOrder | null;
};

function partToDraft(part: Part, qty = 1): DraftLine {
  return {
    key: `${part.id}-${Math.random().toString(36).slice(2, 7)}`,
    partId: part.id,
    partNumber: part.partNumber,
    name: part.name,
    qty: String(qty),
    unitPrice: String(part.price || 0),
    unitCost: String(part.cost || 0),
    catalog: true,
  };
}

function blankDraft(): DraftLine {
  return {
    key: newDraftKey(),
    partId: "",
    partNumber: "",
    name: "",
    qty: "1",
    unitPrice: "",
    unitCost: "",
    catalog: false,
  };
}

export function PreOrderFormDialog({ open, onOpenChange, order }: Props) {
  const { parts } = useInventory();
  const { addOrder, updateOrder } = usePreOrders();
  const editing = Boolean(order?.id);

  const [clientId, setClientId] = useState<string | undefined>();
  const [clientName, setClientName] = useState("");
  const [orderedAt, setOrderedAt] = useState(localTodayIso());
  const [amountPaid, setAmountPaid] = useState("");
  const [shipmentCost, setShipmentCost] = useState("");
  const [notes, setNotes] = useState("");
  const [needsProcurement, setNeedsProcurement] = useState(true);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [partQuery, setPartQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    if (order) {
      setClientId(order.clientId);
      setClientName(order.clientName);
      setOrderedAt(order.orderedAt);
      setAmountPaid(String(order.amountPaid || 0));
      setShipmentCost(order.shipmentCost ? String(order.shipmentCost) : "");
      setNotes(order.notes ?? "");
      setNeedsProcurement(order.needsProcurement);
      setLines(
        order.lines.map((line) => ({
          key: `${line.partId}-${Math.random().toString(36).slice(2, 7)}`,
          partId: line.partId,
          partNumber: line.partNumber,
          name: line.name,
          qty: String(line.qty),
          unitPrice: String(line.unitPrice),
          unitCost: line.unitCost ? String(line.unitCost) : "",
          catalog: Boolean(line.partId) && line.partId !== line.partNumber,
        })),
      );
      setPartQuery("");
      return;
    }
    setClientId(undefined);
    setClientName("");
    setOrderedAt(localTodayIso());
    setAmountPaid("");
    setShipmentCost("");
    setNotes("");
    setNeedsProcurement(true);
    setLines([]);
    setPartQuery("");
  }, [open, order]);

  const matches = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return [];
    return parts
      .filter((part) => {
        const numbers = partNumbersOf(part).join(" ").toLowerCase();
        return (
          numbers.includes(q) ||
          part.partNumber.toLowerCase().includes(q) ||
          part.name.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [parts, partQuery]);

  const parsedLines: PreOrderLine[] = lines.map((line) => ({
    partId: line.partId,
    partNumber: line.partNumber.trim(),
    name: line.name.trim(),
    qty: Math.max(1, Math.round(Number(line.qty) || 1)),
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    unitCost: Math.max(0, Number(line.unitCost) || 0),
  }));
  const total = linesTotal(parsedLines);
  const freight = Math.max(0, Number(shipmentCost) || 0);
  const costTotal = goodsCostTotal(parsedLines);
  const landings = allocateFreight(parsedLines, freight);
  const landingByKey = new Map(
    lines.map((line, index) => [line.key, landings[index]] as const),
  );
  const landedTotal = landings.reduce((sum, l) => sum + l.landedTotal, 0);

  const save = () => {
    if (!clientName.trim()) {
      toast.error("Choose a customer");
      return;
    }
    const validLines = parsedLines.filter((line) => line.partNumber);
    if (validLines.length === 0) {
      toast.error("Add at least one part");
      return;
    }
    const payload = {
      clientId,
      clientName: clientName.trim(),
      orderedAt,
      lines: validLines,
      amountPaid: Number(amountPaid) || 0,
      shipmentCost: freight,
      notes,
      needsProcurement,
    };
    if (editing && order) {
      updateOrder(order.id, payload);
      toast.success("Pre-order updated");
    } else {
      addOrder(payload);
      toast.success("Pre-order saved");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit pre-order" : "New customer pre-order"}</DialogTitle>
          <DialogDescription>
            Track deposits for parts ordered from abroad (wasoune 3a echya).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <PartySearchPicker
            kind="client"
            selectedName={clientName}
            onSelect={(party) => {
              setClientId(party.id);
              setClientName(party.name);
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-date">Order date</Label>
              <Input
                id="po-date"
                type="date"
                value={orderedAt}
                onChange={(e) => setOrderedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-deposit">Deposit paid</Label>
              <Input
                id="po-deposit"
                type="number"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-notes">Notes</Label>
            <Input
              id="po-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal note"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={needsProcurement}
              onChange={(e) => setNeedsProcurement(e.target.checked)}
            />
            Still needs to be ordered from abroad
          </label>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Parts</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLines((prev) => [...prev, blankDraft()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add new item
              </Button>
            </div>
            <Input
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
              placeholder="Search catalog part # or name to add…"
            />
            {matches.length > 0 ? (
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {matches.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-border px-2 py-1.5 text-left text-sm hover:bg-muted/40"
                    onClick={() => {
                      setLines((prev) => [...prev, partToDraft(part)]);
                      setPartQuery("");
                    }}
                  >
                    <span>
                      <span className="font-mono text-xs font-semibold">{part.partNumber}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{part.name}</span>
                    </span>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            ) : null}

            {lines.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No parts yet. Search the catalog or add a new item.
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => {
                  const landing = landingByKey.get(line.key);
                  const patch = (changes: Partial<DraftLine>) =>
                    setLines((prev) =>
                      prev.map((row) => (row.key === line.key ? { ...row, ...changes } : row)),
                    );
                  return (
                    <div
                      key={line.key}
                      className="space-y-2 rounded-md border border-border bg-muted/20 p-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          {line.catalog ? (
                            <>
                              <p className="truncate font-mono text-xs font-semibold">
                                {line.partNumber}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {line.name}
                              </p>
                            </>
                          ) : (
                            <>
                              <Input
                                className="h-8 font-mono text-xs"
                                value={line.partNumber}
                                onChange={(e) => patch({ partNumber: e.target.value })}
                                placeholder="Part #"
                              />
                              <Input
                                className="h-8 text-xs"
                                value={line.name}
                                onChange={(e) => patch({ name: e.target.value })}
                                placeholder="Name / description"
                              />
                            </>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setLines((prev) => prev.filter((row) => row.key !== line.key))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Qty</Label>
                          <Input
                            className="h-8"
                            value={line.qty}
                            onChange={(e) => patch({ qty: e.target.value })}
                            inputMode="numeric"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Cost</Label>
                          <Input
                            className="h-8"
                            value={line.unitCost}
                            onChange={(e) => patch({ unitCost: e.target.value })}
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Price</Label>
                          <Input
                            className="h-8"
                            value={line.unitPrice}
                            onChange={(e) => patch({ unitPrice: e.target.value })}
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {landing && freight > 0 && landing.goodsCost > 0 ? (
                        <p className="text-right text-[11px] text-muted-foreground">
                          + {currency(landing.freightShare)} freight → landed{" "}
                          <span className="font-semibold text-foreground">
                            {currency(landing.landedUnitCost)}
                          </span>
                          /unit
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-shipment">Shipment / freight cost (USD)</Label>
            <Input
              id="po-shipment"
              type="number"
              min={0}
              step="0.01"
              value={shipmentCost}
              onChange={(e) => setShipmentCost(e.target.value)}
              placeholder="Add later when goods ship"
            />
            <p className="text-[11px] text-muted-foreground">
              Split across parts by each part&apos;s cost value (cost × qty).
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selling total</span>
              <span className="font-semibold">{currency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Goods cost</span>
              <span>{currency(costTotal)}</span>
            </div>
            {freight > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Freight</span>
                  <span>{currency(freight)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="text-muted-foreground">Landed cost</span>
                  <span className="font-semibold">{currency(landedTotal)}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            {editing ? "Save changes" : "Create pre-order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
