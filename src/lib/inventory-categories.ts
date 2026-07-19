import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleDot,
  LayoutGrid,
  Cpu,
  Gauge,
  Zap,
  Wrench,
  Fan,
  Disc,
  Package,
} from "lucide-react";

import type { Part } from "@/lib/mock-data";

/**
 * Inventory category tiles.
 * `matchCategory: null` = All items (no category filter).
 * `id: "catalog"` = Catalog grid browse mode (handled in inventory page).
 */
export type InventoryCategoryDef = {
  id: string;
  label: string;
  description: string;
  /** Part.category value to filter by, or null for all */
  matchCategory: string | null;
  icon: LucideIcon;
  /** True when category was user-created / renamed (editable). */
  custom?: boolean;
};

/** Special tile id for the catalog grid browse view. */
export const catalogInventoryCategoryId = "catalog";

export type CustomCategoryInput = {
  id: string;
  label: string;
  description?: string;
};

export function slugCategory(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function iconFor(category: string): LucideIcon {
  const c = category.toLowerCase();
  if (c.includes("o-ring") || c.includes("oring")) return CircleDot;
  if (c.includes("sensor")) return Gauge;
  if (c.includes("solenoid") || c.includes("switch") || c.includes("relay")) return Zap;
  if (c.includes("motor") || c.includes("alternator") || c.includes("fan")) return Fan;
  if (c.includes("pump") || c.includes("valve")) return Disc;
  if (c.includes("controller") || c.includes("monitor") || c.includes("harness")) return Cpu;
  if (c.includes("filter") || c.includes("thermostat")) return Wrench;
  return Package;
}

/** Pinned first tiles; remaining categories come from inventory data. */
const pinned: InventoryCategoryDef[] = [
  {
    id: "all",
    label: "All items",
    description: "Full catalog",
    matchCategory: null,
    icon: LayoutGrid,
  },
  {
    id: catalogInventoryCategoryId,
    label: "Catalog",
    description: "Grid · A01 → up",
    matchCategory: null,
    icon: BookOpen,
  },
  {
    id: "o-rings",
    label: "O-Rings",
    description: "Seals by ID & CS",
    matchCategory: "O-Rings",
    icon: CircleDot,
  },
];

export function buildInventoryCategories(
  parts: Part[],
  customCategories: CustomCategoryInput[] = [],
): InventoryCategoryDef[] {
  const counts = new Map<string, number>();
  for (const p of parts) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }

  const customByLabel = new Map(
    customCategories.map((c) => [c.label.toLowerCase(), c]),
  );

  const pinnedLabels = new Set(
    pinned.map((c) => c.matchCategory).filter((x): x is string => Boolean(x)),
  );

  const labels = new Set<string>([...counts.keys()]);
  for (const c of customCategories) labels.add(c.label);

  const rest = [...labels]
    .filter((c) => !pinnedLabels.has(c))
    .sort((a, b) => a.localeCompare(b))
    .map((label) => {
      const custom = customByLabel.get(label.toLowerCase());
      return {
        id: custom?.id ?? slugCategory(label),
        label,
        description:
          custom?.description?.trim() ||
          `${counts.get(label) ?? 0} part${(counts.get(label) ?? 0) === 1 ? "" : "s"}`,
        matchCategory: label,
        icon: iconFor(label),
        custom: Boolean(custom),
      };
    });

  return [...pinned, ...rest];
}

/** Static snapshot for non-reactive callers (seed / SSR). Prefer useInventory().categories. */
export const inventoryCategories: InventoryCategoryDef[] =
  buildInventoryCategories([]);

export const defaultInventoryCategoryId = "all";
