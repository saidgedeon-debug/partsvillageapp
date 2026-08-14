import { useEffect, useState } from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
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
import { markDocumentCreatedPart } from "@/lib/document-created-parts";
import type { Part } from "@/lib/mock-data";

export type DocumentPartCreateMode = "quotation" | "invoice";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quotation: catalog with qty 0 (no stock change). Invoice: stock += qty (deduct later on save). */
  mode?: DocumentPartCreateMode;
  /** Prefill part number from search box. */
  prefillPartNumber?: string;
  /** When editing an existing document (invoice stock is applied immediately). */
  editing?: boolean;
  onCreated: (part: Part, qty: number, mode: DocumentPartCreateMode) => void;
};

export function QuickCreateDocumentPartDialog({
  open,
  onOpenChange,
  mode: modeProp,
  prefillPartNumber = "",
  editing = false,
  onCreated,
}: Props) {
  const { addPart, categoryLabels } = useInventory();
  const [mode, setMode] = useState<DocumentPartCreateMode>(modeProp ?? "invoice");
  const [partNumber, setPartNumber] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Misc");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [boxNumber, setBoxNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isInvoice = mode === "invoice";
  const lockMode = Boolean(modeProp);

  useEffect(() => {
    if (!open) return;
    setMode(modeProp ?? "invoice");
    setPartNumber(prefillPartNumber.trim());
    setName("");
    setCategory(categoryLabels.includes("Misc") ? "Misc" : categoryLabels[0] ?? "Misc");
    setQty("1");
    setPrice("");
    setCost("");
    setBoxNumber("");
    setSubmitting(false);
  }, [open, prefillPartNumber, categoryLabels, modeProp]);

  const submit = () => {
    if (submitting) return;
    const pn = partNumber.trim();
    if (!pn) {
      toast.error("Part number is required");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required");
      return;
    }
    const lineQty = Math.max(1, Math.round(Number(qty)) || 1);
    const unitPrice = price.trim() === "" ? 0 : Number(price);
    const unitCost = cost.trim() === "" ? 0 : Number(cost);
    if (![unitPrice, unitCost].every((n) => Number.isFinite(n) && n >= 0)) {
      toast.error("Price and cost must be valid non-negative numbers");
      return;
    }
    const boxRaw = boxNumber.trim();
    const box = boxRaw === "" ? undefined : Number(boxRaw.replace(/^f-?/i, ""));
    if (boxRaw !== "" && !Number.isFinite(box)) {
      toast.error("Stand / box must be a number (e.g. 26 or F-26)");
      return;
    }

    setSubmitting(true);
    try {
      // Quotation: catalog only (qty 0) — do not change stock levels.
      // Invoice: add sold qty into stock; checkout/save will deduct it.
      const stockQty = isInvoice ? lineQty : 0;
      const part = addPart({
        partNumber: pn,
        name: name.trim() || pn,
        category: category.trim(),
        quantity: stockQty,
        reorderAt: 0,
        cost: unitCost,
        price: unitPrice,
        boxNumber: box,
      });
      if (isInvoice) markDocumentCreatedPart(part.id);
      onCreated(part, lineQty, mode);
      toast.success(
        isInvoice
          ? editing
            ? `Created ${part.partNumber} · added & stock deducted`
            : `Created ${part.partNumber} · stock +${lineQty} (will deduct on save)`
          : `Created ${part.partNumber} · added to quotation (stock unchanged)`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create product");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-muted-foreground" />
            New product
          </DialogTitle>
          <DialogDescription>
            {isInvoice
              ? editing
                ? "Creates the part in inventory and deducts the sold qty now (edit save does not change stock)."
                : "Creates the part in inventory, adds stock for the sold qty, then deducts it when you save the invoice."
              : "Creates the part in the catalog at qty 0 and adds it to the quotation — stock is not changed."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          {!lockMode ? (
            <div className="space-y-1.5">
              <Label>Document type</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "quotation" ? "default" : "outline"}
                  className="h-8 flex-1"
                  onClick={() => setMode("quotation")}
                >
                  Quotation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "invoice" ? "default" : "outline"}
                  className="h-8 flex-1"
                  onClick={() => setMode("invoice")}
                >
                  Invoice
                </Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="qcp-pn">Part number</Label>
            <Input
              id="qcp-pn"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="e.g. 5I-8633"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qcp-name">Name / description</Label>
            <Input
              id="qcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional — defaults to part number"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qcp-cat">Category</Label>
            <Input
              id="qcp-cat"
              list="qcp-cat-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              autoComplete="off"
            />
            <datalist id="qcp-cat-list">
              {categoryLabels.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qcp-qty">Qty</Label>
              <Input
                id="qcp-qty"
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcp-price">Unit price</Label>
              <Input
                id="qcp-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qcp-cost">Unit cost (optional)</Label>
              <Input
                id="qcp-cost"
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcp-box">Stand / box (optional)</Label>
              <Input
                id="qcp-box"
                value={boxNumber}
                onChange={(e) => setBoxNumber(e.target.value)}
                placeholder="F-26"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create & add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
