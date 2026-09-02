import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
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
import { currency, filterStandCode, locationOf, oemNumbersOf, partNumbersOf, type Part } from "@/lib/mock-data";
import { HYDRAULIC_SUBCATEGORIES } from "@/lib/hydraulics-inventory";
import { FILTER_SUBCATEGORIES } from "@/lib/filters-inventory";
import { compressImageToDataUrl } from "@/lib/image-compress";
import { buildPartDemandMap, partDemandFor } from "@/lib/demand-forecast";
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
  /** Prefill fields when creating (e.g. from stock take). */
  createPrefill?: {
    partNumber?: string;
    name?: string;
    quantity?: string;
  };
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
  replacesCodes: string;
  notes: string;
  imageUrl: string;
};

const emptyForm = (category = "", prefill?: Props["createPrefill"]): FormState => ({
  partNumbers: prefill?.partNumber?.trim() ?? "",
  name: prefill?.name?.trim() ?? "",
  category,
  subcategory: category === "Hydraulic Parts" ? "Center Pin" : "",
  quantity: prefill?.quantity?.trim() ?? "0",
  reorderAt: "0",
  cost: "",
  price: "",
  boxNumber: "",
  insideDiameterMm: "",
  crossSectionMm: "",
  compatibility: "",
  replacesCodes: "",
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
    boxNumber:
      part.category === "Filters" && part.boxNumber != null
        ? filterStandCode(part.boxNumber)
        : part.boxNumber != null
          ? String(part.boxNumber)
          : "",
    insideDiameterMm: part.insideDiameterMm ?? "",
    crossSectionMm: part.crossSectionMm ?? "",
    compatibility: part.compatibility.join(", "),
    replacesCodes: (part.replacesCodes ?? []).join(", "),
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
  createPrefill,
}: Props) {
  const { addPart, updatePart, categoryLabels } = useInventory();
  const { askDocumentForPart } = useCart();
  const { documents, invoices } = useDocuments();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [gallery, setGallery] = useState<string[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const creating = mode === "create";
  const editing = mode === "edit" || creating;
  const priceHistory = part ? partPriceHistory(part.id, part.partNumber, documents) : [];
  const lastSale = priceHistory.find((event) => event.kind === "sale");
  const lastCost = priceHistory.find((event) => event.kind === "cost");
  const demand = useMemo(() => {
    if (!part || editing) return null;
    return partDemandFor(part, buildPartDemandMap(invoices));
  }, [part, invoices, editing]);

  const attachPhotoFiles = (files: File[]) => {
    const room = Math.max(0, 5 - gallery.length);
    const slice = files.slice(0, room);
    if (!slice.length) {
      toast.message("Photo gallery is full (max 5)");
      return;
    }
    const saveNow = !editing && Boolean(part);
    const partId = part?.id;
    void (async () => {
      try {
        const urls = await Promise.all(slice.map((file) => compressImageToDataUrl(file)));
        setGallery((current) => {
          const next = [...current, ...urls].slice(0, 5);
          if (saveNow && partId) {
            updatePart(partId, { imageUrl: next[0], imageUrls: next });
          }
          return next;
        });
        setForm((f) => ({ ...f, imageUrl: f.imageUrl || urls[0] || "" }));
        toast.success(saveNow ? "Photo saved on part" : `${urls.length} photo${urls.length === 1 ? "" : "s"} attached`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not compress photo");
      }
    })();
  };

  useEffect(() => {
    if (!open) return;
    if (creating || !part) {
      setForm(emptyForm(defaultCategory, createPrefill));
      setGallery([]);
    } else {
      setForm(partToForm(part));
      setGallery(part.imageUrls?.length ? part.imageUrls : part.imageUrl ? [part.imageUrl] : []);
    }
  }, [open, part, creating, defaultCategory, createPrefill]);

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
    const cost = form.cost.trim() === "" ? 0 : Number(form.cost);
    const price = form.price.trim() === "" ? 0 : Number(form.price);
    if (![qty, reorder, cost, price].every((n) => Number.isFinite(n))) {
      toast.error("Qty, reorder, cost, and price must be numbers");
      return;
    }
    if ([qty, reorder, cost, price].some((n) => n < 0)) {
      toast.error("Qty, reorder, cost, and price cannot be negative");
      return;
    }
    const boxRaw = form.boxNumber.trim();
    const boxNumber =
      boxRaw === "" ? undefined : Number(boxRaw.replace(/^f-?/i, ""));
    if (boxRaw !== "" && !Number.isFinite(boxNumber)) {
      toast.error("Stand / box must be a number (e.g. 26 or F-26)");
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
      replacesCodes: form.replacesCodes
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      imageUrls: gallery.length ? gallery : undefined,
    };

    if (creating) {
      try {
        addPart(payload);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add part");
        return;
      }
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
  const showSealFields = form.category === "Seals" || part?.category === "Seals";
  const showDimFields = showORingFields || showSealFields;
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
            ) : (
              <div className="sm:col-span-2 rounded-lg border border-dashed border-border p-4 text-center">
                <p className="mb-2 text-sm text-muted-foreground">No photo yet</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (files.length) attachPhotoFiles(files);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Take / attach photo
              </Button>
            </div>
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
            {part.category === "Filters" && (
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
            {part.category === "Seals" && (
              <>
                <Field label="Subcategory" value={part.subcategory ?? ""} />
                <Field label="Qty" value={part.quantity.toLocaleString()} />
                <Field
                  label="OD (mm)"
                  value={
                    part.partNumber.match(/^WR\s*([\d.]+)/i)?.[1] ??
                    part.notes?.match(/OD\s+([\d.]+)/i)?.[1] ??
                    ""
                  }
                />
                <Field label="ID (mm)" value={part.insideDiameterMm ?? ""} />
                <Field label="Height (mm)" value={part.crossSectionMm ?? ""} />
              </>
            )}
            {part.category !== "O-Rings" && part.category !== "Seals" && (
              <>
                <Field label="Qty" value={part.quantity.toLocaleString()} />
                <Field
                  label="Machine Compatibility"
                  value={part.compatibility.length ? part.compatibility.join(", ") : ""}
                />
                {part.category === "Filters" ? (
                  <Field label="Stand" value={locationOf(part)} />
                ) : (
                  <Field label="Catalog page" value={part.catalogPage ?? ""} />
                )}
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
            {part.replacesCodes?.length ? (
              <div className="sm:col-span-2">
                <Field label="Replaces codes" value={part.replacesCodes.join(" · ")} />
              </div>
            ) : null}
            {demand ? (
              <div className="sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Demand
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <p className="text-sm">
                    Sold last 30d / 90d:{" "}
                    <span className="font-semibold tabular-nums">
                      {demand.unitsSold30d} / {demand.unitsSold90d}
                    </span>
                  </p>
                  <p className="text-sm">
                    ≈{" "}
                    <span className="font-semibold tabular-nums">{demand.avgPerMonth}</span> / month
                  </p>
                  <p className="text-sm">
                    Days of cover:{" "}
                    <span className="font-semibold tabular-nums">
                      {demand.daysOfCover != null ? demand.daysOfCover : "—"}
                    </span>
                  </p>
                  {demand.suggestedReorderQty > 0 ? (
                    <p className="text-sm">
                      Suggested reorder:{" "}
                      <span className="font-semibold tabular-nums">
                        {demand.suggestedReorderQty}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reorder suggested</p>
                  )}
                </div>
              </div>
            ) : null}
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
            {form.category === "Filters" && (
              <>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="part-filter-subcategory">Subcategory</Label>
                  <Input
                    id="part-filter-subcategory"
                    list="filter-subcategory-options"
                    value={form.subcategory}
                    onChange={set("subcategory")}
                    placeholder="Engine Lube, Fuel System, …"
                  />
                  <datalist id="filter-subcategory-options">
                    {FILTER_SUBCATEGORIES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="part-filter-stand">Stand</Label>
                  <Input
                    id="part-filter-stand"
                    className="font-mono"
                    value={form.boxNumber}
                    onChange={set("boxNumber")}
                    placeholder="F-26"
                  />
                </div>
              </>
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
            {showDimFields && (
              <>
                {showORingFields ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="part-box">Box</Label>
                    <Input
                      id="part-box"
                      inputMode="numeric"
                      value={form.boxNumber}
                      onChange={set("boxNumber")}
                    />
                  </div>
                ) : null}
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
                  <Label htmlFor="part-id">{showSealFields ? "ID (mm)" : "ID (mm)"}</Label>
                  <Input
                    id="part-id"
                    className="font-mono"
                    value={form.insideDiameterMm}
                    onChange={set("insideDiameterMm")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="part-cs">{showSealFields ? "Height (mm)" : "CS (mm)"}</Label>
                  <Input
                    id="part-cs"
                    className="font-mono"
                    value={form.crossSectionMm}
                    onChange={set("crossSectionMm")}
                  />
                </div>
              </>
            )}
            {!showDimFields && (
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
              <Input
                id="part-cost"
                inputMode="decimal"
                value={form.cost}
                onChange={set("cost")}
                placeholder="Leave empty if unknown"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-price">Selling price</Label>
              <Input
                id="part-price"
                inputMode="decimal"
                value={form.price}
                onChange={set("price")}
                placeholder="Leave empty if unknown"
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
              <Label htmlFor="part-replaces">Replaces codes (comma-separated)</Label>
              <Input
                id="part-replaces"
                className="font-mono"
                value={form.replacesCodes}
                onChange={set("replacesCodes")}
                placeholder="e.g. OLD-123, SUPERSEDED-456"
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
                placeholder="https://… or /parts/photo.jpg"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    e.target.value = "";
                    if (files.length) attachPhotoFiles(files);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Take photo
                </Button>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  className="max-w-xs text-xs"
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    e.target.value = "";
                    if (files.length) attachPhotoFiles(files);
                  }}
                />
              </div>
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
