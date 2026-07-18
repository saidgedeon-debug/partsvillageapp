import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { currency, type Part } from "@/lib/mock-data";

type Mode = "view" | "edit";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: Part | null;
  mode: Mode;
  onModeChange?: (mode: Mode) => void;
};

type FormState = {
  partNumber: string;
  name: string;
  category: string;
  quantity: string;
  reorderAt: string;
  cost: string;
  price: string;
  boxNumber: string;
  insideDiameterMm: string;
  crossSectionMm: string;
  compatibility: string;
  notes: string;
};

function partToForm(part: Part): FormState {
  return {
    partNumber: part.partNumber,
    name: part.name,
    category: part.category,
    quantity: String(part.quantity),
    reorderAt: String(part.reorderAt),
    cost: String(part.cost),
    price: String(part.price),
    boxNumber: part.boxNumber != null ? String(part.boxNumber) : "",
    insideDiameterMm: part.insideDiameterMm ?? "",
    crossSectionMm: part.crossSectionMm ?? "",
    compatibility: part.compatibility.join(", "),
    notes: part.notes ?? "",
  };
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value || "—"}</p>
    </div>
  );
}

export function PartDetailDialog({
  open,
  onOpenChange,
  part,
  mode,
  onModeChange,
}: Props) {
  const { updatePart } = useInventory();
  const { askDocumentForPart } = useCart();
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!open || !part) return;
    setForm(partToForm(part));
  }, [open, part]);

  const set =
    (key: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const save = () => {
    if (!part || !form) return;
    if (!form.partNumber.trim()) {
      toast.error("Part number is required");
      return;
    }
    const qty = Number(form.quantity);
    const reorder = Number(form.reorderAt);
    const cost = Number(form.cost);
    const price = Number(form.price);
    if (![qty, reorder, cost, price].every((n) => Number.isFinite(n))) {
      toast.error("Qty, reorder, cost, and price must be numbers");
      return;
    }
    const boxRaw = form.boxNumber.trim();
    const boxNumber = boxRaw === "" ? undefined : Number(boxRaw);
    if (boxRaw !== "" && !Number.isFinite(boxNumber)) {
      toast.error("Box must be a number");
      return;
    }

    updatePart(part.id, {
      partNumber: form.partNumber.trim(),
      name: form.name.trim() || form.partNumber.trim(),
      category: form.category.trim() || part.category,
      quantity: qty,
      reorderAt: reorder,
      cost,
      price,
      boxNumber,
      insideDiameterMm: form.insideDiameterMm.trim() || undefined,
      crossSectionMm: form.crossSectionMm.trim() || undefined,
      compatibility: form.compatibility
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
    });
    toast.success(`Updated ${form.partNumber.trim()}`);
    onModeChange?.("view");
    onOpenChange(false);
  };

  const addToCart = () => {
    if (!part) return;
    askDocumentForPart(part);
    onOpenChange(false);
  };

  return (
    <Dialog open={open && Boolean(part)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {part && form ? (
          <>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit part" : "View part"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update stock, pricing, and catalog details."
              : `${part.partNumber} · ${part.category}`}
          </DialogDescription>
        </DialogHeader>

        {mode === "view" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Part #" value={part.partNumber} />
            <Field label="Category" value={part.category} />
            <div className="sm:col-span-2">
              <Field label="Name" value={part.name} />
            </div>
            <Field label="Box" value={part.boxNumber != null ? String(part.boxNumber) : ""} />
            <Field label="Qty" value={part.quantity.toLocaleString()} />
            <Field label="ID (mm)" value={part.insideDiameterMm ?? ""} />
            <Field label="CS (mm)" value={part.crossSectionMm ?? ""} />
            <Field label="Cost" value={part.cost > 0 ? currency(part.cost) : ""} />
            <Field label="Price" value={part.price > 0 ? currency(part.price) : ""} />
            <Field label="Reorder at" value={String(part.reorderAt)} />
            <Field
              label="Compatibility"
              value={part.compatibility.length ? part.compatibility.join(", ") : ""}
            />
            <div className="sm:col-span-2">
              <Field label="Notes" value={part.notes ?? ""} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="part-number">Part #</Label>
              <Input
                id="part-number"
                className="font-mono"
                value={form.partNumber}
                onChange={set("partNumber")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-category">Category</Label>
              <Input
                id="part-category"
                value={form.category}
                onChange={set("category")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-name">Name</Label>
              <Input id="part-name" value={form.name} onChange={set("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-box">Box</Label>
              <Input
                id="part-box"
                inputMode="numeric"
                value={form.boxNumber}
                onChange={set("boxNumber")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-qty">Qty</Label>
              <Input
                id="part-qty"
                inputMode="numeric"
                value={form.quantity}
                onChange={set("quantity")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-id">ID (mm)</Label>
              <Input
                id="part-id"
                className="font-mono"
                value={form.insideDiameterMm}
                onChange={set("insideDiameterMm")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-cs">CS (mm)</Label>
              <Input
                id="part-cs"
                className="font-mono"
                value={form.crossSectionMm}
                onChange={set("crossSectionMm")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-cost">Cost</Label>
              <Input
                id="part-cost"
                inputMode="decimal"
                value={form.cost}
                onChange={set("cost")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-price">Price</Label>
              <Input
                id="part-price"
                inputMode="decimal"
                value={form.price}
                onChange={set("price")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-reorder">Reorder at</Label>
              <Input
                id="part-reorder"
                inputMode="numeric"
                value={form.reorderAt}
                onChange={set("reorderAt")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-compat">Compatibility (comma-separated)</Label>
              <Input
                id="part-compat"
                value={form.compatibility}
                onChange={set("compatibility")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-notes">Notes</Label>
              <Textarea
                id="part-notes"
                rows={3}
                value={form.notes}
                onChange={set("notes")}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {mode === "view" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onModeChange?.("edit")}>
                Edit
              </Button>
              <Button type="button" onClick={addToCart}>
                Add to cart
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForm(partToForm(part));
                  onModeChange?.("view");
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                Save
              </Button>
            </>
          )}
        </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
