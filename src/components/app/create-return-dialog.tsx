import { useEffect, useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

import type { CartLine } from "@/components/app/cart-context";
import {
  invoiceHasReturnableLines,
  invoiceRemaining,
  useDocuments,
  type SavedDocument,
} from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { confirmAction } from "@/components/app/confirm-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { documentBelongsToClient } from "@/lib/ar-statement";
import { currency } from "@/lib/mock-data";
import { localTodayIso } from "@/lib/date-local";
import { invoiceDiscountRatio, roundMoney } from "@/lib/document-money";
import { lineQtyByPart, physicalRestockCap } from "@/lib/stock-sale";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected invoice when opened from an invoice row. */
  invoice?: SavedDocument | null;
  /** Limit invoice picker to this client. */
  clientId?: string;
  onRecorded?: (creditNote: SavedDocument) => void;
};

type ReturnRow = {
  partId: string;
  partNumber: string;
  name: string;
  unitPrice: number;
  unitCost: number;
  category: string;
  boxNumber?: number;
  insideDiameterMm?: string;
  crossSectionMm?: string;
  soldQty: number;
  alreadyReturned: number;
  maxReturnable: number;
  qtyToReturn: string;
};

function lineKey(partId: string, unitPrice: number): string {
  return `${partId}::${Math.round(unitPrice * 100)}`;
}

function buildRows(invoice: SavedDocument, creditNotes: SavedDocument[]): ReturnRow[] {
  const byLine = new Map<string, ReturnRow>();
  for (const line of invoice.lines) {
    if (!line.partId || line.category === "Payment" || line.category === "Discount") continue;
    const price = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
    const key = lineKey(line.partId, price);
    const existing = byLine.get(key);
    const sold = (existing?.soldQty ?? 0) + (Number.isFinite(line.qty) ? line.qty : 0);
    byLine.set(key, {
      partId: line.partId,
      partNumber: line.partNumber,
      name: line.name,
      unitPrice: price,
      unitCost: line.unitCost,
      category: line.category,
      boxNumber: line.boxNumber,
      insideDiameterMm: line.insideDiameterMm,
      crossSectionMm: line.crossSectionMm,
      soldQty: sold,
      alreadyReturned: 0,
      maxReturnable: 0,
      qtyToReturn: "0",
    });
  }

  const returnedByKey = new Map<string, number>();
  for (const note of creditNotes) {
    if (note.kind !== "credit_note" || note.invoiceId !== invoice.id) continue;
    for (const line of note.lines) {
      if (!line.partId || line.category === "Payment" || line.category === "Discount") continue;
      const price = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
      const key = lineKey(line.partId, price);
      returnedByKey.set(key, (returnedByKey.get(key) ?? 0) + (Number.isFinite(line.qty) ? line.qty : 0));
    }
  }

  return [...byLine.values()]
    .map((row) => {
      const already = returnedByKey.get(lineKey(row.partId, row.unitPrice)) ?? 0;
      const max = Math.max(0, Math.floor(row.soldQty - already));
      return {
        ...row,
        alreadyReturned: already,
        maxReturnable: max,
        qtyToReturn: max > 0 ? String(max) : "0",
      };
    })
    .filter((r) => r.soldQty > 0);
}

export function CreateReturnDialog({
  open,
  onOpenChange,
  invoice,
  clientId,
  onRecorded,
}: Props) {
  const { invoices, creditNotes, recordInvoiceReturn } = useDocuments();
  const { adjustPartQuantity, getPart } = useInventory();
  const { getClient } = useParties();
  const [submitting, setSubmitting] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [restock, setRestock] = useState(true);
  const [returnDate, setReturnDate] = useState(localTodayIso());
  const [note, setNote] = useState("");

  const returnableInvoices = useMemo(() => {
    const client = clientId ? getClient(clientId) : undefined;
    return invoices
      .filter((iv) => {
        if (client && !documentBelongsToClient(iv, client)) return false;
        if (!client && clientId && iv.partyId !== clientId) return false;
        return invoiceHasReturnableLines(iv, creditNotes);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, creditNotes, clientId, getClient]);

  const selected = invoices.find((iv) => iv.id === invoiceId) ?? null;

  useEffect(() => {
    if (!open) return;
    const pre =
      invoice?.id && returnableInvoices.some((iv) => iv.id === invoice.id) ? invoice.id : "";
    const fallback = returnableInvoices[0]?.id ?? "";
    const nextId = pre || fallback;
    setInvoiceId(nextId);
    const inv = invoices.find((i) => i.id === nextId);
    setRows(inv ? buildRows(inv, creditNotes) : []);
    setRestock(true);
    setReturnDate(localTodayIso());
    setNote("");
    setSubmitting(false);
  }, [open, invoice, returnableInvoices, invoices, creditNotes]);

  useEffect(() => {
    if (!selected) {
      setRows([]);
      return;
    }
    setRows(buildRows(selected, creditNotes));
  }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset rows when invoice changes

  const creditPreview = useMemo(() => {
    const ratio = selected ? invoiceDiscountRatio(selected) : 1;
    return roundMoney(
      rows.reduce((s, r) => {
        const qty = Math.floor(Number(r.qtyToReturn));
        if (!Number.isFinite(qty) || qty <= 0) return s;
        return s + qty * (r.unitPrice || 0) * ratio;
      }, 0),
    );
  }, [rows, selected]);

  const setQty = (partId: string, unitPrice: number, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.partId === partId && r.unitPrice === unitPrice ? { ...r, qtyToReturn: value } : r,
      ),
    );
  };

  const submit = async () => {
    if (submitting) return;
    try {
      if (!selected) {
        toast.error("Select an invoice");
        return;
      }

      const lines: CartLine[] = [];
      const restockPairs: { partId: string; qty: number }[] = [];
      const missing: string[] = [];

      const soldByPart = lineQtyByPart(selected.lines);
      const alreadyRestockedByPart = new Map<string, number>();
      for (const note of creditNotes) {
        if (note.kind !== "credit_note" || note.invoiceId !== selected.id) continue;
        const restocked = new Set(note.restockedPartIds ?? []);
        for (const line of note.lines) {
          if (!line.partId) continue;
          const wasRestocked =
            restocked.size > 0 ? restocked.has(line.partId) : Boolean(note.stockRestocked);
          if (!wasRestocked) continue;
          alreadyRestockedByPart.set(
            line.partId,
            (alreadyRestockedByPart.get(line.partId) ?? 0) +
              (Number.isFinite(line.qty) ? line.qty : 0),
          );
        }
      }

      for (const row of rows) {
        const qty = Math.floor(Number(row.qtyToReturn));
        if (!Number.isFinite(qty) || qty <= 0) continue;
        if (qty > row.maxReturnable) {
          toast.error(
            `Cannot return ${qty} of ${row.partNumber} (max ${row.maxReturnable})`,
          );
          return;
        }
        lines.push({
          partId: row.partId,
          partNumber: row.partNumber,
          name: row.name,
          category: row.category,
          boxNumber: row.boxNumber,
          insideDiameterMm: row.insideDiameterMm,
          crossSectionMm: row.crossSectionMm,
          unitPrice: row.unitPrice,
          unitCost: row.unitCost,
          qty,
        });
        if (restock) {
          if (!getPart(row.partId)) {
            missing.push(row.partNumber);
            continue;
          }
          const soldQty = soldByPart.get(row.partId) ?? row.soldQty;
          const oversoldQty = selected.oversoldByPart?.[row.partId] ?? 0;
          const already = alreadyRestockedByPart.get(row.partId) ?? 0;
          const cap = physicalRestockCap(soldQty, oversoldQty, already);
          const physicalQty = Math.min(qty, cap);
          if (physicalQty > 0) {
            restockPairs.push({ partId: row.partId, qty: physicalQty });
            alreadyRestockedByPart.set(row.partId, already + physicalQty);
          }
        }
      }

      if (lines.length === 0) {
        toast.error("Enter at least one quantity to return");
        return;
      }

      let allowRefundOverage = false;
      const remaining = invoiceRemaining(selected, creditNotes);
      if (creditPreview > remaining + 0.005) {
        const ok = await confirmAction({
          title: "Credit exceeds remaining balance",
          description: `This return credits ${currency(creditPreview)} but only ${currency(remaining)} remains on the invoice.\n\nContinue and record the overage as refund owed?`,
          confirmLabel: "Continue",
          destructive: true,
        });
        if (!ok) return;
        allowRefundOverage = true;
      }

      setSubmitting(true);

      const creditNote = recordInvoiceReturn({
        invoiceId: selected.id,
        lines,
        restock,
        restockedPartIds: restock ? restockPairs.map((p) => p.partId) : [],
        date: returnDate,
        note: note.trim() || undefined,
        allowRefundOverage,
      });

      for (const { partId, qty } of restockPairs) {
        adjustPartQuantity(partId, qty);
      }

      const units = lines.reduce((s, l) => s + l.qty, 0);
      toast.success(
        `Credit note ${creditNote.id} · ${units} unit${units === 1 ? "" : "s"} · ${currency(creditNote.total)}`,
      );
      if (missing.length) {
        toast.warning(`Not in catalog (skipped restock): ${missing.join(", ")}`);
      }
      onOpenChange(false);
      onRecorded?.(creditNote);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record return");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-muted-foreground" />
            Return from invoice
          </DialogTitle>
          <DialogDescription>
            Pick lines and quantities from a past invoice. Creates a credit note and can restock
            inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="return-invoice">Invoice</Label>
            <Select value={invoiceId || undefined} onValueChange={setInvoiceId}>
              <SelectTrigger id="return-invoice">
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {returnableInvoices.map((iv) => (
                  <SelectItem key={iv.id} value={iv.id}>
                    {iv.id} · {iv.partyName} · {iv.date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!returnableInvoices.length ? (
              <p className="text-xs text-muted-foreground">
                No invoices with returnable lines.
              </p>
            ) : selected ? (
              <p className="text-xs text-muted-foreground">
                {selected.partyName} · Total {currency(selected.total)}
              </p>
            ) : null}
          </div>

          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Part</th>
                    <th className="px-2 py-2 font-medium">Sold</th>
                    <th className="px-2 py-2 font-medium">Returned</th>
                    <th className="px-2 py-2 font-medium">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.partId}::${row.unitPrice}`} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.partNumber}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {row.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {currency(row.unitPrice)} each
                        </div>
                      </td>
                      <td className="px-2 py-2 tabular-nums">{row.soldQty}</td>
                      <td className="px-2 py-2 tabular-nums">{row.alreadyReturned}</td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={row.maxReturnable}
                          step={1}
                          className="h-8 w-20"
                          disabled={row.maxReturnable <= 0}
                          value={row.qtyToReturn}
                          onChange={(e) => setQty(row.partId, row.unitPrice, e.target.value)}
                        />
                        <div
                          className={cn(
                            "mt-0.5 text-[10px] text-muted-foreground",
                            row.maxReturnable <= 0 && "text-destructive",
                          )}
                        >
                          max {row.maxReturnable}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="return-date">Date</Label>
              <Input
                id="return-date"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={restock}
                  onChange={(e) => setRestock(e.target.checked)}
                />
                Restock inventory
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="return-note">Note (optional)</Label>
            <Input
              id="return-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Staff note — not printed on PDF title"
            />
          </div>

          <p className="text-sm font-medium">
            Credit total: {currency(creditPreview)}
          </p>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!selected || submitting}>
            {submitting ? "Saving…" : "Create credit note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
