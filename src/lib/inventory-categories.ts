import type { LucideIcon } from "lucide-react";
import { CircleDot, Disc, Gauge, LayoutGrid, Link2, Package } from "lucide-react";

import type { Part } from "@/lib/mock-data";

/**
 * Inventory category tiles.
 * Main categories are added one by one as stock lines are seeded.
 * `matchCategory: null` = All items.
 */
export type CategoryGroupId = string;

export type InventoryCategoryDef = {
  id: string;
  label: string;
  description: string;
  /** Part.category value to filter by, or null for all / catalog */
  matchCategory: string | null;
  icon: LucideIcon;
  /** True when category was user-created / renamed (editable). */
  custom?: boolean;
  /** Reserved for future subtype groups (currently unused). */
  group?: CategoryGroupId;
};

/** Special tile ids. */
export const catalogInventoryCategoryId = "catalog";
/** @deprecated Group tiles removed — kept for older call sites. */
export const sensorsInventoryCategoryId = "sensors";

export type CustomCategoryInput = {
  id: string;
  label: string;
  description?: string;
};

export type GroupSubcategory = {
  label: string;
  count: number;
};

/** @deprecated Use GroupSubcategory */
export type SensorSubcategory = GroupSubcategory;

export function slugCategory(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** No aggregate group tiles — categories are added one by one. */
const GROUP_RULES: {
  id: CategoryGroupId;
  label: string;
  icon: LucideIcon;
  match: (c: string) => boolean;
}[] = [];

export const categoryGroupIds = GROUP_RULES.map((r) => r.id);

/** Always offered in the part form category datalist. */
export const STANDARD_CATEGORY_LABELS = [
  "O-Rings",
  "Couplings",
  "Gauges & Accessories",
  "Hydraulic Parts",
] as const;

export function getCategoryGroupLabel(groupId: CategoryGroupId): string {
  return GROUP_RULES.find((r) => r.id === groupId)?.label ?? groupId;
}

export function getCategoryGroupIcon(groupId: CategoryGroupId): LucideIcon {
  return GROUP_RULES.find((r) => r.id === groupId)?.icon ?? Package;
}

/**
 * Collapse hyphen / slash / spacing variants so near-duplicates share one key.
 */
export function categoryKey(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "/")
    .replace(/[-_]+/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayCategory(category: string): string {
  return category.trim();
}

export function categoriesMatch(a: string, b: string): boolean {
  return categoryKey(a) === categoryKey(b);
}

export function resolveCategoryGroup(_category: string): CategoryGroupId | null {
  return null;
}

export function isGroupedCategory(category: string): boolean {
  return resolveCategoryGroup(category) != null;
}

export function isSensorCategory(_category: string): boolean {
  return false;
}

export function categoryBelongsToGroup(
  _category: string,
  _groupId: CategoryGroupId,
): boolean {
  return false;
}

function iconFor(category: string): LucideIcon {
  const c = category.toLowerCase();
  if (c.includes("o-ring") || c.includes("oring")) return CircleDot;
  if (c.includes("coupling") || c.includes("coupler")) return Link2;
  if (c.includes("gauge")) return Gauge;
  if (c.includes("hydraulic")) return Disc;
  return Package;
}

/** Fixed main tiles — add new stock lines here one by one. */
const basePinned: InventoryCategoryDef[] = [
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
  {
    id: "couplings",
    label: "Couplings",
    description: "Flywheel & pump couplings",
    matchCategory: "Couplings",
    icon: Link2,
  },
  {
    id: "gauges",
    label: "Gauges & Accessories",
    description: "Sight gauges & tank accessories",
    matchCategory: "Gauges & Accessories",
    icon: Gauge,
  },
  {
    id: "hydraulics",
    label: "Hydraulic Parts",
    description: "Center Pin · Ball Guide · pump internals",
    matchCategory: "Hydraulic Parts",
    icon: Disc,
  },
];

/** Whitelist — nothing else is shown on the inventory tiles. */
export const MAIN_INVENTORY_CATEGORY_IDS = [
  "all",
  "o-rings",
  "couplings",
  "gauges",
  "hydraulics",
] as const;

export function buildGroupSubcategories(
  _parts: Part[],
  _groupId: CategoryGroupId,
): GroupSubcategory[] {
  return [];
}

export function buildSensorSubcategories(parts: Part[]): GroupSubcategory[] {
  return buildGroupSubcategories(parts, "sensors");
}

export function countPartsInGroup(parts: Part[], groupId: CategoryGroupId): number {
  let n = 0;
  for (const p of parts) {
    if (categoryBelongsToGroup(p.category, groupId)) n += 1;
  }
  return n;
}

export function buildGroupCounts(parts: Part[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parts) {
    const g = resolveCategoryGroup(p.category);
    if (g) out[g] = (out[g] ?? 0) + 1;
  }
  return out;
}

/** Leftover categories outside the main tiles (for catalog browse). */
export function buildUngroupedCategories(parts: Part[]): GroupSubcategory[] {
  const main = new Set(
    STANDARD_CATEGORY_LABELS.map((l) => categoryKey(l)),
  );
  const byKey = new Map<string, { label: string; count: number }>();
  for (const p of parts) {
    const label = displayCategory(p.category);
    if (main.has(categoryKey(label))) continue;
    const key = categoryKey(label);
    const prev = byKey.get(key);
    if (prev) prev.count += 1;
    else byKey.set(key, { label, count: 1 });
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export type CategoryBrowsePick =
  | { kind: "group"; id: CategoryGroupId; label: string; count: number }
  | { kind: "category"; label: string; count: number };

/** Catalog picker: only the main categories that have parts. */
export function buildCategoryBrowsePicks(parts: Part[]): CategoryBrowsePick[] {
  const counts = new Map<string, number>();
  for (const p of parts) {
    const label = displayCategory(p.category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const main: CategoryBrowsePick[] = [];
  for (const label of STANDARD_CATEGORY_LABELS) {
    const n = counts.get(label) ?? 0;
    if (n > 0) main.push({ kind: "category", label, count: n });
  }
  return main;
}

export function buildInventoryCategories(
  parts: Part[],
  _customCategories: CustomCategoryInput[] = [],
): InventoryCategoryDef[] {
  const counts = new Map<string, number>();
  for (const p of parts) {
    const label = displayCategory(p.category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return basePinned.map((tile) => {
    if (!tile.matchCategory) {
      return {
        ...tile,
        description: `${parts.length} part${parts.length === 1 ? "" : "s"}`,
      };
    }
    const n = counts.get(displayCategory(tile.matchCategory)) ?? 0;
    return {
      ...tile,
      description: `${n} part${n === 1 ? "" : "s"}`,
    };
  });
}

/** Static snapshot for non-reactive callers (seed / SSR). Prefer useInventory().categories. */
export const inventoryCategories: InventoryCategoryDef[] =
  buildInventoryCategories([]);

export const defaultInventoryCategoryId = "all";
