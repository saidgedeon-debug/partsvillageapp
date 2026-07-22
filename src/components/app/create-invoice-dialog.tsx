import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { CartLine } from "@/components/app/cart-context";
import { useDocuments, type SavedDocument } from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { PartySearchPicker } from "@/components/app/party-search-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadPdf } from "@/lib/document-export";
import { currency, partNumbersOf, type Part } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, dialog edits this invoice instead of creating a new one. */
  document?: SavedDocument | null;
};

function formatSize(id?: string, cs?: string): string {
  const a = id?.trim() ?? "";
  const b = cs?.trim() ?? "";
  if (a && b) return `${a} x ${b}`;
  return a || b;
}

/** Parse "26.5 x 3" / "26.5×3" / "26.5*3" into ID + CS. */
function parseSize(raw: string): { insideDiameterMm?: string; crossSectionMm?: string } {
  const t = raw.trim();
  if (!t) return { insideDiameterMm: undefined, crossSectionMm: undefined };
  const m = t.match(/^([\d.]+)\s*[x×*]\s*([\d.]+)$/i);
  if (m) return { insideDiameterMm: m[1], crossSectionMm: m[2] };
  return { insideDiameterMm: t, crossSectionMm: undefined };
}

function partToLine(part: Part, qty = 1): CartLine {
  return {
    partId: part.id,
    partNumber: part.partNumber,
    name: part.name,
    category: part.category,
    boxNumber: part.boxNumber,
    insideDiameterMm: part.insideDiameterMm,
    crossSectionMm: part.crossSectionMm,
    unitPrice: part.price,
    unitCost: part.cost,
    qty,
  };
}

export function CreateInvoiceDialog({ open, onOpenChange, document: editing }: Props) {
  const { parts, updatePart, getPart } = useInventory();
  const { addDocument, updateDocument } = useDocuments();
  const { addOrder } = useFleet();
  const { clients } = useParties();
  const isEdit = Boolean(editing?.id);

  const [partyName, setPartyName] = useState("");
  const [partyId, setPartyId] = useState<string | undefined>();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [partQuery, setPartQuery] = useState("");
  const [deductStock, setDeductStock] = useState(true);
  const [internalNote, setInternalNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPartyName(editing.partyName);
      setPartyId(editing.partyId);
      setLines(editing.lines.map((l) => ({ ...l })));
      setInternalNote(editing.internalNote ?? "");
      setDeductStock(false);
      setPartQuery("");
      return;
    }
    setPartyName("");
    setPartyId(undefined);
    setLines([]);
    setPartQuery("");
    setDeductStock(true);
    setInternalNote("");
  }, [open, editing]);

  const partMatches = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return [];
    return parts
      .filter((p) => {
        const numbers = partNumbersOf(p).join(" ").toLowerCase();
        return (
          numbers.includes(q) ||
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.insideDiameterMm ?? "").toLowerCase().includes(q) ||
          (p.crossSectionMm ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [partQuery, parts]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.qty * (l.unitPrice || 0), 0),
    [lines],
  );

  const addPartLine = (part: Part) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.partId === part.id);
      if (existing) {
        return prev.map((l) => (l.partId === part.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, partToLine(part, 1)];
    });
    setPartQuery("");
    toast.success(`Added ${part.partNumber}`);
  };

  const updateLine = (
    partId: string,
    patch: Partial<Pick<CartLine, "qty" | "unitPrice" | "name" | "partNumber">> & {
      size?: string;
    },
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.partId !== partId) return l;
        const next = { ...l };
        if (patch.qty !== undefined) {
          next.qty = Number.isFinite(patch.qty) ? Math.max(1, Math.round(patch.qty)) : l.qty;
        }
        if (patch.unitPrice !== undefined) {
          next.unitPrice = Number.isFinite(patch.unitPrice)
            ? Math.max(0, patch.unitPrice)
            : l.unitPrice;
        }
        if (patch.name !== undefined) next.name = patch.name;
        if (patch.partNumber !== undefined) next.partNumber = patch.partNumber;
        if (patch.size !== undefined) {
          const parsed = parseSize(patch.size);
          next.insideDiameterMm = parsed.insideDiameterMm;
          next.crossSectionMm = parsed.crossSectionMm;
        }
        return next;
      }),
    );
  };

  const removeLine = (partId: string) => {
    setLines((prev) => prev.filter((l) => l.partId !== partId));
  };

  const ready = partyName.trim().length > 0 && lines.length > 0;

  const saveInvoice = () => {
    if (!ready) {
      toast.error("Choose a client and add at least one part");
      return;
    }

    const note = internalNote.trim() || undefined;
    const invoiceTotal = lines.reduce((s, l) => s + l.qty * (l.unitPrice || 0), 0);

    if (isEdit && editing) {
      const saved: SavedDocument = {
        ...editing,
        partyId,
        partyName: partyName.trim(),
        total: invoiceTotal,
        lines: [...lines],
        internalNote: note,
      };
      updateDocument(saved);
      downloadPdf({
        id: saved.id,
        documentKind: "invoice",
        partyKind: "client",
        partyName: saved.partyName,
        lines: saved.lines,
        createdAt: new Date(saved.createdAt),
        includeCost: true,
      });
      toast.success(`Invoice ${saved.id} updated`);
      onOpenChange(false);
      return;
    }

    const createdAt = new Date();
    const exportedId = downloadPdf({
      documentKind: "invoice",
      partyKind: "client",
      partyName: partyName.trim(),
      lines,
      createdAt,
      includeCost: true,
    });

    let stockDeducted = false;
    if (deductStock) {
      let deducted = 0;
      for (const line of lines) {
        const part = getPart(line.partId);
        if (!part) continue;
        updatePart(line.partId, { quantity: Math.max(0, part.quantity - line.qty) });
        deducted += 1;
      }
      stockDeducted = deducted > 0;
    }

    const saved: SavedDocument = {
      id: exportedId,
      kind: "invoice",
      partyKind: "client",
      partyId,
      partyName: partyName.trim(),
      date: createdAt.toISOString().slice(0, 10),
      createdAt: createdAt.toISOString(),
      total: invoiceTotal,
      status: "Unpaid",
      lines: [...lines],
      stockDeducted,
      internalNote: note,
    };
    addDocument(saved);

    const client =
      (partyId && clients.find((c) => c.id === partyId)) ||
      clients.find((c) => c.name.toLowerCase() === partyName.trim().toLowerCase());
    if (client) {
      addOrder({
        id: `ord-${exportedId}`,
        clientId: client.id,
        machineId: "",
        date: saved.date,
        status: "Pending",
        documentId: exportedId,
        lines: lines.map((l) => ({
          partId: l.partId,
          partNumber: l.partNumber,
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      });
    }

    toast.success(
      `Invoice ${exportedId} saved` + (stockDeducted ? " · stock updated" : ""),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle>{isEdit ? `Edit invoice ${editing?.id}` : "New invoice"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update client, lines, prices, or your private note — then save."
              : "Choose a client, add parts, edit description and size, then create the invoice."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <section className="space-y-2">
            <Label>Client</Label>
            <PartySearchPicker
              kind="client"
              selectedName={partyName}
              onSelect={(p) => {
                setPartyName(p.name);
                setPartyId(p.id);
              }}
            />
          </section>

          <section className="space-y-2">
            <Label>Add parts</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
                placeholder="Search part #, name, size…"
                className="h-10 pl-9"
                autoComplete="off"
              />
            </div>
            {partQuery.trim() && (
              <div className="max-h-44 overflow-y-auto rounded-md border border-border">
                {partMatches.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No parts match “{partQuery.trim()}”.
                  </p>
                ) : (
                  partMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                      onClick={() => addPartLine(p)}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold">{p.partNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.insideDiameterMm && p.crossSectionMm
                            ? `${p.insideDiameterMm} x ${p.crossSectionMm}`
                            : p.name}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">stock {p.quantity}</Badge>
                        <span className="text-xs font-medium">{currency(p.price)}</span>
                        <Plus className="h-4 w-4 text-accent" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lines ({lines.length})</Label>
              <span className="text-sm font-semibold">{currency(total)}</span>
            </div>
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Search and add parts above.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_6.5rem_4rem_5rem_4.5rem_2.25rem] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>Code</span>
                  <span>Description</span>
                  <span>Size</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {lines.map((l) => (
                  <div
                    key={l.partId}
                    className="grid grid-cols-[5.5rem_minmax(0,1fr)_6.5rem_4rem_5rem_4.5rem_2.25rem] items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <Input
                      value={l.partNumber}
                      onChange={(e) => updateLine(l.partId, { partNumber: e.target.value })}
                      className="h-8 font-mono text-xs font-semibold"
                      aria-label={`Code for ${l.partNumber}`}
                    />
                    <Input
                      value={l.name}
                      onChange={(e) => updateLine(l.partId, { name: e.target.value })}
                      placeholder="Description…"
                      className="h-8 text-xs"
                      aria-label={`Description for ${l.partNumber}`}
                    />
                    <Input
                      value={formatSize(l.insideDiameterMm, l.crossSectionMm)}
                      onChange={(e) => updateLine(l.partId, { size: e.target.value })}
                      placeholder="26.5 x 3"
                      className="h-8 font-mono text-xs"
                      aria-label={`Size for ${l.partNumber}`}
                    />
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={l.qty}
                      onChange={(e) => updateLine(l.partId, { qty: Number(e.target.value) })}
                      className="h-8 font-mono text-xs"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={l.unitPrice}
                      onChange={(e) =>
                        updateLine(l.partId, { unitPrice: Number(e.target.value) })
                      }
                      className="h-8 font-mono text-xs"
                    />
                    <p className="text-right text-xs font-medium">
                      {currency(l.qty * (l.unitPrice || 0))}
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(l.partId)}
                      aria-label={`Remove ${l.partNumber}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="invoice-internal-note">Internal note</Label>
              <span className="text-[11px] text-muted-foreground">Private · not on PDF</span>
            </div>
            <Textarea
              id="invoice-internal-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Staff-only note (delivery tip, reminder, etc.) — never printed on the invoice…"
              className="min-h-[72px] resize-y"
            />
          </section>

          {!isEdit && (
            <section className="space-y-2">
              <Label>Stock</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  variant={deductStock ? "default" : "outline"}
                  onClick={() => setDeductStock(true)}
                >
                  Deduct qty
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  variant={!deductStock ? "default" : "outline"}
                  onClick={() => setDeductStock(false)}
                >
                  Keep qty
                </Button>
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className={cn("text-sm text-muted-foreground", ready && "font-medium text-foreground")}>
            {ready
              ? `Total ${currency(total)} · ${partyName}`
              : "Select client and parts to continue"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!ready}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={saveInvoice}
            >
              {isEdit ? "Save changes" : "Create invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
