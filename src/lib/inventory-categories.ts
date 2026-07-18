import type { LucideIcon } from "lucide-react";
import { CircleDot, LayoutGrid } from "lucide-react";

/**
 * Inventory category tiles. Add new entries here as catalogs grow.
 * `matchCategory: null` = All items (no category filter).
 */
export type InventoryCategoryDef = {
  id: string;
  label: string;
  description: string;
  /** Part.category value to filter by, or null for all */
  matchCategory: string | null;
  icon: LucideIcon;
};

export const inventoryCategories: InventoryCategoryDef[] = [
  {
    id: "all",
    label: "All items",
    description: "Full catalog",
    matchCategory: null,
    icon: LayoutGrid,
  },
  {
    id: "o-rings",
    label: "O-Rings",
    description: "Seals by ID & CS",
    matchCategory: "O-Rings",
    icon: CircleDot,
  },
  // Later examples:
  // { id: "filters", label: "Filters", description: "…", matchCategory: "Filters", icon: … },
  // { id: "hoses", label: "Hoses", description: "…", matchCategory: "Hoses", icon: … },
];

export const defaultInventoryCategoryId = inventoryCategories[0]?.id ?? "all";
