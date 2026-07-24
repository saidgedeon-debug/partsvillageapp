import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useDocuments } from "@/components/app/documents-context";
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
import { currency, oemNumbersOf, partNumbersOf, type Part } from "@/lib/mock-data";
import { HYDRAULIC_SUBCATEGORIES } from "@/lib/hydraulics-inventory";
import { compressImageToDataUrl } from "@/lib/image-compress";
import { partPriceHistory } from "@/lib/part-price-history";

type Mode = "view" | "edit" | "create";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: Part | null;
  mode: Mode;
  onModeChange?: (mode: Mode) => void;
  /** Prefill category when creating. */
  defaultCategory?: string;
};

type FormState = {
  partNumbers: string;
  name: string;
  category: string;
  subcategory: string;
  quantity: string;
  reorderAt: string;
  cost: string;
  price: string;
  boxNumber: string;
  insideDiameterMm: string;
  crossSectionMm: string;
  compatibility: string;
  notes: string;
  imageUrl: string;
};

const emptyForm = (category = ""): FormState => ({
  partNumbers: "",
  name: "",
  category,
  subcategory: category === "Hydraulic Parts" ? "Center Pin" : "",
  quantity: "0",
  reorderAt: "0",
  cost: "0",
  price: "0",
  boxNumber: "",
  insideDiameterMm: "",
  crossSectionMm: "",
  compatibility: "",
  notes: "",
  imageUrl: "",
});

function partToForm(part: Part): FormState {
  return {
    partNumbers: partNumbersOf(part).join("\n"),
    name: part.name,
    category: part.category,
    subcategory: part.subcategory ?? "",
    quantity: String(part.quantity),
    reorderAt: String(part.reorderAt),
    cost: String(part.cost),
    price: String(part.price),
    boxNumber: part.boxNumber != null ? String(part.boxNumber) : "",
    insideDiameterMm: part.insideDiameterMm ?? "",
    crossSectionMm: part.crossSectionMm ?? "",
    compatibility: part.compatibility.join(", "),
    notes: part.notes ?? "",
    imageUrl: part.imageUrl ?? "",
  };
}

function Field({ label, value }: { label: string; value: string }) {
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
  defaultCategory = "",
}: Props) {
  const { addPart, updatePart, categoryLabels } = useInventory();
  const { askDocumentForPart } = useCart();
  const { documents } = useDocuments();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [gallery, setGallery] = useState<string[]>([]);
  const creating = mode === "create";
  const editing = mode === "edit" || creating;
  const priceHistory = part ? partPriceHistory(part.id, part.partNumber, documents) : [];
  const lastSale = priceHistory.find((event) => event.kind === "sale");
  const lastCost = priceHistory.find((event) => event.kind === "cost");

  useEffect(() => {
    if (!open) return;
    if (creating || !part) {
      setForm(emptyForm(defaultCategory));
      setGallery([]);
    } else {
      setForm(partToForm(part));
      setGallery(part.imageUrls?.length ? part.imageUrls : part.imageUrl ? [part.imageUrl] : []);
    }
  }, [open, part, creating, defaultCategory]);

  const set = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () => {
    const numbers = form.partNumbers
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (numbers.length === 0) {
      toast.error("At least one part number is required");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Category is required");
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
    if ([qty, reorder, cost, price].some((n) => n < 0)) {
      toast.error("Qty, reorder, cost, and price cannot be negative");
      return;
    }
    const boxRaw = form.boxNumber.trim();
    const boxNumber = boxRaw === "" ? undefined : Number(boxRaw);
    if (boxRaw !== "" && !Number.isFinite(boxNumber)) {
      toast.error("Box must be a number");
      return;
    }

    const payload = {
      partNumber: numbers[0],
      partNumbers: numbers,
      name: form.name.trim() || numbers[0],
      category: form.category.trim(),
      subcategory: form.subcategory.trim() || undefined,
      quantity: Math.max(0, Math.round(qty)),
      reorderAt: Math.max(0, Math.round(reorder)),
      cost: Math.max(0, cost),
      price: Math.max(0, price),
      boxNumber,
      insideDiameterMm: form.insideDiameterMm.trim() || undefined,
      crossSectionMm: form.crossSectionMm.trim() || undefined,
      compatibility: form.compatibility
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      imageUrls: gallery.length ? gallery : undefined,
    };

    if (creating) {
      addPart(payload);
      toast.success(`Added ${numbers[0]}`);
      onOpenChange(false);
      return;
    }

    if (!part) return;
    updatePart(part.id, payload);
    toast.success(`Updated ${numbers[0]}`);
    onModeChange?.("view");
    onOpenChange(false);
  };

  const addToCart = () => {
    if (!part) return;
    askDocumentForPart(part);
    onOpenChange(false);
  };

  const showORingFields = form.category === "O-Rings" || part?.category === "O-Rings";
  const dialogOpen = open && (creating || Boolean(part));

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {creating ? "Add part" : mode === "edit" ? "Edit part" : "View part"}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? "Create a new inventory item."
              : mode === "edit"
                ? "Update stock, pricing, and catalog details."
                : part
                  ? `${part.partNumber} · ${part.category}`
                  : ""}
          </DialogDescription>
        </DialogHeader>

        {!editing && part ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {part.imageUrls?.[0] || part.imageUrl ? (
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <img
                  src={part.imageUrls?.[0] || part.imageUrl}
                  alt={part.partNumber}
                  className="mx-auto max-h-56 w-auto object-contain"
                />
                {(part.imageUrls?.length ?? 0) > 1 ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {part.imageUrls!.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded border object-contain"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Field label="Part Code" value={part.partNumber} />
            </div>
            {part.category !== "O-Rings" && (
              <div className="sm:col-span-2">
                <Field
                  label="OEM / Serial Number"
                  value={oemNumbersOf(part).length ? oemNumbersOf(part).join(" · ") : ""}
                />
              </div>
            )}
            {part.category === "O-Rings" && (
              <div className="sm:col-span-2">
                <Field label="Part numbers" value={partNumbersOf(part).join(" · ")} />
              </div>
            )}
            <Field label="Category" value={part.category} />
            {part.category === "Hydraulic Parts" && (
              <Field label="Subcategory" value={part.subcategory ?? ""} />
            )}
            <div className="sm:col-span-2">
              <Field label="Part Description" value={part.description?.trim() || part.name} />
            </div>
            {part.category === "O-Rings" && (
              <>
                <Field label="Box" value={part.boxNumber != null ? String(part.boxNumber) : ""} />
                <Field label="Qty" value={part.quantity.toLocaleString()} />
                <Field label="ID (mm)" value={part.insideDiameterMm ?? ""} />
                <Field label="CS (mm)" value={part.crossSectionMm ?? ""} />
              </>
            )}
            {part.category !== "O-Rings" && (
              <>
                <Field label="Qty" value={part.quantity.toLocaleString()} />
                <Field
                  label="Machine Compatibility"
                  value={part.compatibility.length ? part.compatibility.join(", ") : ""}
                />
                <Field label="Catalog page" value={part.catalogPage ?? ""} />
              </>
            )}
            <Field label="Cost" value={part.cost > 0 ? currency(part.cost) : ""} />
            <Field label="Price" value={part.price > 0 ? currency(part.price) : ""} />
            <Field
              label="Last sold"
              value={
                lastSale
                  ? `${currency(lastSale.amount)} · ${lastSale.partyName} · ${lastSale.date}`
                  : ""
              }
            />
            <Field
              label="Last supplier cost"
              value={
                lastCost
                  ? `${currency(lastCost.amount)} · ${lastCost.partyName} · ${lastCost.date}`
                  : ""
              }
            />
            <Field label="Reorder at" value={String(part.reorderAt)} />
            <div className="sm:col-span-2">
              <Field label="Notes" value={part.notes ?? ""} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-numbers">Part numbers</Label>
              <Textarea
                id="part-numbers"
                className="font-mono"
                rows={3}
                placeholder={"Primary number on first line\nOEM / alternate on next lines"}
                value={form.partNumbers}
                onChange={set("partNumbers")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-category">Category</Label>
              <Input
                id="part-category"
                list="inventory-category-options"
                value={form.category}
                onChange={(e) => {
                  const category = e.target.value;
                  setForm((f) => ({
                    ...f,
                    category,
                    subcategory:
                      category === "Hydraulic Parts"
                        ? f.subcategory || "Center Pin"
                        : f.subcategory,
                  }));
                }}
                placeholder="Select or type a category"
              />
              <datalist id="inventory-category-options">
                {categoryLabels.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            {form.category === "Hydraulic Parts" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="part-subcategory">Subcategory</Label>
                <Input
                  id="part-subcategory"
                  list="hydraulic-subcategory-options"
                  value={form.subcategory}
                  onChange={set("subcategory")}
                  placeholder="Center Pin or Ball Guide"
                />
                <datalist id="hydraulic-subcategory-options">
                  {HYDRAULIC_SUBCATEGORIES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-name">Description / name</Label>
              <Input id="part-name" value={form.name} onChange={set("name")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-compat">Machine (comma-separated)</Label>
              <Input
                id="part-compat"
                value={form.compatibility}
                onChange={set("compatibility")}
                placeholder="e.g. Komatsu PC200-7, Hitachi EX200"
              />
            </div>
            {showORingFields && (
              <>
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
              </>
            )}
            {!showORingFields && (
              <div className="space-y-1.5">
                <Label htmlFor="part-qty">Qty</Label>
                <Input
                  id="part-qty"
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={set("quantity")}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="part-cost">Cost</Label>
              <Input id="part-cost" inputMode="decimal" value={form.cost} onChange={set("cost")} />
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
              <Label htmlFor="part-notes">Notes</Label>
              <Textarea id="part-notes" rows={2} value={form.notes} onChange={set("notes")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="part-photo">Photo URL or upload</Label>
              <Input
                id="part-photo"
                value={form.imageUrl}
                onChange={set("imageUrl")}
                placeholder="/kafu-parts/A01-1.jpg or https://…"
              />
              <Input
                type="file"
                accept="image/*"
                multiple
                className="text-xs"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])].slice(
                    0,
                    Math.max(0, 5 - gallery.length),
                  );
                  if (!files.length) return;
                  void (async () => {
                    try {
                      const urls = await Promise.all(
                        files.map((file) => compressImageToDataUrl(file)),
                      );
                      setGallery((current) => [...current, ...urls].slice(0, 5));
                      setForm((f) => ({ ...f, imageUrl: f.imageUrl || urls[0] || "" }));
                      toast.success(`${urls.length} photo${urls.length === 1 ? "" : "s"} attached`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not compress photo");
                    }
                  })();
                }}
              />
              {gallery.length ? (
                <div className="flex flex-wrap gap-2">
                  {gallery.map((url, index) => (
                    <div key={url} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setGallery((items) => [
                            items[index],
                            ...items.filter((_, i) => i !== index),
                          ]);
                          setForm((f) => ({ ...f, imageUrl: url }));
                        }}
                        className={`rounded border p-1 ${index === 0 ? "border-accent" : "border-border"}`}
                        title="Set as primary"
                      >
                        <img src={url} alt="" className="h-16 w-16 object-contain" />
                      </button>
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-xs text-destructive-foreground"
                        onClick={() => {
                          const next = gallery.filter((_, i) => i !== index);
                          setGallery(next);
                          setForm((f) => ({ ...f, imageUrl: next[0] ?? "" }));
                        }}
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!editing && part ? (
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
                  if (creating) onOpenChange(false);
                  else if (part) {
                    setForm(partToForm(part));
                    onModeChange?.("view");
                  }
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                {creating ? "Create" : "Save"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
