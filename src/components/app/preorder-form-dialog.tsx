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
};

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
        })),
      );
      setPartQuery("");
      return;
    }
    setClientId(undefined);
    setClientName("");
    setOrderedAt(localTodayIso());
    setAmountPaid("");
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
    partNumber: line.partNumber,
    name: line.name,
    qty: Math.max(1, Math.round(Number(line.qty) || 1)),
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
  }));
  const total = linesTotal(parsedLines);

  const save = () => {
    if (!clientName.trim()) {
      toast.error("Choose a customer");
      return;
    }
    if (parsedLines.length === 0) {
      toast.error("Add at least one part");
      return;
    }
    const payload = {
      clientId,
      clientName: clientName.trim(),
      orderedAt,
      lines: parsedLines,
      amountPaid: Number(amountPaid) || 0,
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

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Parts</Label>
            <Input
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
              placeholder="Search part # or name to add…"
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
              <p className="py-3 text-center text-xs text-muted-foreground">No parts yet.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.key} className="grid grid-cols-[1fr_70px_90px_36px] items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold">{line.partNumber}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{line.name}</p>
                    </div>
                    <Input
                      value={line.qty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.key === line.key ? { ...row, qty: e.target.value } : row,
                          ),
                        )
                      }
                      inputMode="numeric"
                    />
                    <Input
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.key === line.key ? { ...row, unitPrice: e.target.value } : row,
                          ),
                        )
                      }
                      inputMode="decimal"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-right text-sm font-semibold">Total {currency(total)}</p>
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
