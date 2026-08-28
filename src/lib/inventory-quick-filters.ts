export type InventoryQuickFilterId =
  | "seals-stock"
  | "zero-cost"
  | "low-stock"
  | "favorites"
  | "no-photo";

export type InventoryQuickFilter = {
  id: InventoryQuickFilterId;
  label: string;
};

export const INVENTORY_QUICK_FILTERS: InventoryQuickFilter[] = [
  { id: "seals-stock", label: "Seals with stock" },
  { id: "zero-cost", label: "Zero cost" },
  { id: "low-stock", label: "Low stock" },
  { id: "favorites", label: "Favorites" },
  { id: "no-photo", label: "No photo" },
];
