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
  Cable,
  Snowflake,
  Link2,
} from "lucide-react";

import type { Part } from "@/lib/mock-data";

/**
 * Inventory category tiles.
 * `matchCategory: null` = All items / Catalog / group tile (see `group`).
 * `id: "catalog"` = Catalog grid browse mode (handled in inventory page).
 * Group tiles open all matching subtypes with a sub-category picker.
 */
export type CategoryGroupId =
  | "sensors"
  | "switches"
  | "solenoids"
  | "relays"
  | "filters"
  | "pumps"
  | "valves"
  | "controllers"
  | "motors"
  | "undercarriage"
  | "bearings"
  | "gaskets"
  | "cooling"
  | "harnesses"
  | "couplings";

export type InventoryCategoryDef = {
  id: string;
  label: string;
  description: string;
  /** Part.category value to filter by, or null for all / group / catalog */
  matchCategory: string | null;
  icon: LucideIcon;
  /** True when category was user-created / renamed (editable). */
  custom?: boolean;
  /** Group tile id when this tile aggregates many Part.category values. */
  group?: CategoryGroupId;
};

/** Special tile ids. */
export const catalogInventoryCategoryId = "catalog";
/** @deprecated Prefer CategoryGroupId "sensors" — kept for older call sites. */
export const sensorsInventoryCategoryId: CategoryGroupId = "sensors";

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

type GroupRule = {
  id: CategoryGroupId;
  label: string;
  icon: LucideIcon;
  match: (c: string) => boolean;
};

/**
 * First match wins — order resolves overlaps
 * (e.g. sensor cables → Sensors, solenoid valves → Solenoids).
 */
const GROUP_RULES: GroupRule[] = [
  {
    id: "sensors",
    label: "Sensors",
    icon: Gauge,
    match: (c) => c.includes("sensor"),
  },
  {
    id: "switches",
    label: "Switches",
    icon: Zap,
    match: (c) => c.includes("switch"),
  },
  {
    id: "solenoids",
    label: "Solenoids",
    icon: Zap,
    match: (c) => c.includes("solenoid"),
  },
  {
    id: "relays",
    label: "Relays",
    icon: Zap,
    match: (c) => c.includes("relay"),
  },
  {
    id: "filters",
    label: "Filters",
    icon: Wrench,
    match: (c) => c.includes("filter"),
  },
  {
    id: "pumps",
    label: "Pumps",
    icon: Disc,
    match: (c) => /\bpump\b/.test(c),
  },
  {
    id: "valves",
    label: "Valves",
    icon: Disc,
    match: (c) => c.includes("valve"),
  },
  {
    id: "bearings",
    label: "Bearings & bushings",
    icon: CircleDot,
    match: (c) => /bearing|bushing|thrust washer/.test(c),
  },
  {
    id: "gaskets",
    label: "Gaskets & seal kits",
    icon: Package,
    match: (c) => /gasket|seal kit/.test(c),
  },
  {
    id: "couplings",
    label: "Couplings",
    icon: Link2,
    match: (c) => /coupling|coupler|\bjoint\b|universal joint|u-joint/.test(c),
  },
  {
    id: "motors",
    label: "Motors & starters",
    icon: Fan,
    match: (c) =>
      /\bmotor\b/.test(c) ||
      c.includes("throttle actuator") ||
      c.includes("throttle drive") ||
      (c.includes("starter") && !c.includes("relay") && !c.includes("solenoid")),
  },
  {
    id: "undercarriage",
    label: "Undercarriage",
    icon: Link2,
    match: (c) =>
      /track |carrier roller|idler|sprocket|final drive/.test(c),
  },
  {
    id: "controllers",
    label: "Controllers & modules",
    icon: Cpu,
    match: (c) =>
      /controller|control module|telematics|interface module|monitor unit|lcd monitor|dashboard display|gauge cluster/.test(
        c,
      ),
  },
  {
    id: "cooling",
    label: "Cooling & HVAC",
    icon: Snowflake,
    match: (c) =>
      /ac clutch|ac compressor|\bac\b|climate|hvac|radiator|intercooler|thermostat|fan clutch|cooling fan|cooling tank/.test(
        c,
      ),
  },
  {
    id: "harnesses",
    label: "Harnesses & wiring",
    icon: Cable,
    match: (c) => /harness|wiring/.test(c),
  },
];

export const categoryGroupIds = GROUP_RULES.map((r) => r.id);

/** Always offered in the part form category datalist (even with 0 stock). */
export const STANDARD_CATEGORY_LABELS = [
  "O-Rings",
  "Couplings",
] as const;

export function getCategoryGroupLabel(groupId: CategoryGroupId): string {
  return GROUP_RULES.find((r) => r.id === groupId)?.label ?? groupId;
}

export function getCategoryGroupIcon(groupId: CategoryGroupId): LucideIcon {
  return GROUP_RULES.find((r) => r.id === groupId)?.icon ?? Package;
}

/**
 * Collapse hyphen / slash / spacing variants so near-duplicates share one key.
 * e.g. "High Pressure Sensor" ↔ "High-Pressure Sensor"
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

/** Preferred display spelling for merged keys. */
const PREFERRED_LABEL: Record<string, string> = {
  "high pressure sensor": "High-Pressure Sensor",
  "low pressure sensor": "Low-Pressure Sensor",
  "scu control valve": "SCU Control Valve",
  "oil water temperature sensor": "Oil/Water Temperature Sensor",
  "oil water pressure switch": "Oil/Water Pressure Switch",
  "fuel oil temperature sensor": "Fuel/Oil Temperature Sensor",
  "pressure control switch": "Pressure / Control Switch",
  "flameout fuel shut off": "Flameout / Fuel Shut-off",
  "flameout shut off solenoid": "Flameout / Shut-off Solenoid",
  "fuel shut off flameout solenoid": "Fuel Shut-off / Flameout Solenoid",
  "glow preheater plug": "Glow / Preheater Plug",
  "preheater glow control": "Preheater / Glow Control",
  "relay glow control": "Relay / Glow Control",
  "cartridge pilot valve": "Cartridge / Pilot Valve",
  "check non return valve": "Check / Non-Return Valve",
  "common rail injection harness": "Common Rail / Injection Harness",
  "engine control harness": "Engine / Control Harness",
  "pilot cartridge solenoid": "Pilot / Cartridge Solenoid",
  "relief pressure valve": "Relief / Pressure Valve",
  "motor relief control valve": "Motor Relief / Control Valve",
  "throttle drive board": "Throttle Drive Board",
  "travel final drive motor": "Travel / Final Drive Motor",
  "water pump cooling": "Water Pump / Cooling",
  "intercooler aftercooler": "Intercooler / Aftercooler",
  "thermostat cooling control": "Thermostat / Cooling Control",
  "bearing bushing": "Bearing / Bushing",
  "coupling joint": "Coupling / Joint",
  "universal joint": "Universal Joint",
  "engine gasket seal": "Engine Gasket / Seal",
  "linkage bushing bearing": "Linkage Bushing / Bearing",
  "thrust washer bearing": "Thrust Washer / Bearing",
  "idler tensioner": "Idler / Tensioner",
  "track chain link": "Track Chain / Link",
  "final drive gear carrier": "Final Drive Gear / Carrier",
  "cabin control interface": "Cabin Control Interface",
  "climate temperature control": "Climate / Temperature Control",
  "cooling fan mount hardware": "Cooling Fan / Mount / Hardware",
  "exhaust mounting hardware": "Exhaust Mounting / Hardware",
  "muffler silencer": "Muffler / Silencer",
  "diode block array": "Diode Block / Array",
  "fuse protection": "Fuse / Protection",
  "circuit protection": "Circuit Protection",
  "sensor connector plug kit": "Sensor Connector / Plug Kit",
  "solenoid manifold cartridge": "Solenoid Manifold / Cartridge",
  "starter control relay": "Starter / Control Relay",
  "starter drive clutch": "Starter Drive / Clutch",
  "parking brake disc": "Parking Brake / Disc",
  "piston cylinder rod": "Piston / Cylinder Rod",
  "piston power assembly": "Piston / Power Assembly",
  "rocker lifter assembly": "Rocker / Lifter Assembly",
  "lifter pushrod": "Lifter / Pushrod",
  "timing gear drive": "Timing Gear / Drive",
  "timing module relay": "Timing Module / Relay",
  "valve guide seat": "Valve Guide / Seat",
  "engine valve valve train": "Engine Valve / Valve Train",
  "cylinder liner sleeve": "Cylinder Liner / Sleeve",
  "fuel water separator": "Fuel / Water Separator",
  "fuel feed primer pump": "Fuel Feed / Primer Pump",
  "horn alarm": "Horn / Alarm",
  "governor accelerator cable": "Governor / Accelerator Cable",
  "water alarm sensor": "Water Alarm Sensor",
  "air alarm sensor": "Air Alarm Sensor",
};

export function displayCategory(category: string): string {
  const key = categoryKey(category);
  return PREFERRED_LABEL[key] ?? category.trim();
}

export function categoriesMatch(a: string, b: string): boolean {
  return categoryKey(a) === categoryKey(b);
}

/** Which group a Part.category belongs to, if any. */
export function resolveCategoryGroup(category: string): CategoryGroupId | null {
  const c = category.trim().toLowerCase();
  if (!c || c === "o-rings") return null;
  for (const rule of GROUP_RULES) {
    if (rule.match(c)) return rule.id;
  }
  return null;
}

export function isGroupedCategory(category: string): boolean {
  return resolveCategoryGroup(category) != null;
}

/** True when part.category is a sensor type (grouped under Sensors tile). */
export function isSensorCategory(category: string): boolean {
  return resolveCategoryGroup(category) === "sensors";
}

export function categoryBelongsToGroup(
  category: string,
  groupId: CategoryGroupId,
): boolean {
  return resolveCategoryGroup(category) === groupId;
}

function iconFor(category: string): LucideIcon {
  const group = resolveCategoryGroup(category);
  if (group) {
    const rule = GROUP_RULES.find((r) => r.id === group);
    if (rule) return rule.icon;
  }
  const c = category.toLowerCase();
  if (c.includes("o-ring") || c.includes("oring")) return CircleDot;
  if (c.includes("alternator") || c.includes("fan")) return Fan;
  if (c.includes("thermostat")) return Wrench;
  return Package;
}

/** Fixed tiles shown before dynamic leftover categories. */
const basePinned: InventoryCategoryDef[] = [
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

function groupTiles(): InventoryCategoryDef[] {
  return GROUP_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    description: "Pick subtype",
    matchCategory: null,
    icon: rule.icon,
    group: rule.id,
  }));
}

export function buildGroupSubcategories(
  parts: Part[],
  groupId: CategoryGroupId,
): GroupSubcategory[] {
  /** key → { display, count } */
  const byKey = new Map<string, { label: string; count: number }>();
  for (const p of parts) {
    if (!categoryBelongsToGroup(p.category, groupId)) continue;
    const key = categoryKey(p.category);
    const preferred = displayCategory(p.category);
    const prev = byKey.get(key);
    if (prev) {
      prev.count += 1;
      // Prefer PREFERRED_LABEL spelling when present
      if (PREFERRED_LABEL[key]) prev.label = PREFERRED_LABEL[key];
    } else {
      byKey.set(key, { label: preferred, count: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
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

export function buildGroupCounts(parts: Part[]): Record<CategoryGroupId, number> {
  const out = Object.fromEntries(
    GROUP_RULES.map((r) => [r.id, 0]),
  ) as Record<CategoryGroupId, number>;
  for (const p of parts) {
    const g = resolveCategoryGroup(p.category);
    if (g) out[g] += 1;
  }
  return out;
}

/** Ungrouped leftover categories, merged by near-duplicate key. */
export function buildUngroupedCategories(parts: Part[]): GroupSubcategory[] {
  const byKey = new Map<string, { label: string; count: number }>();
  for (const p of parts) {
    if (p.category === "O-Rings") continue;
    if (isGroupedCategory(p.category)) continue;
    const key = categoryKey(p.category);
    const preferred = displayCategory(p.category);
    const prev = byKey.get(key);
    if (prev) {
      prev.count += 1;
      if (PREFERRED_LABEL[key]) prev.label = PREFERRED_LABEL[key];
    } else {
      byKey.set(key, { label: preferred, count: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export type CategoryBrowsePick =
  | { kind: "group"; id: CategoryGroupId; label: string; count: number }
  | { kind: "category"; label: string; count: number };

/** Catalog / picker options: groups first, then ungrouped leftovers. */
export function buildCategoryBrowsePicks(parts: Part[]): CategoryBrowsePick[] {
  const groupCounts = buildGroupCounts(parts);
  const groups: CategoryBrowsePick[] = GROUP_RULES.map((r) => ({
    kind: "group" as const,
    id: r.id,
    label: r.label,
    count: groupCounts[r.id],
  })).filter((g) => g.count > 0);

  const loose: CategoryBrowsePick[] = buildUngroupedCategories(parts).map((c) => ({
    kind: "category" as const,
    label: c.label,
    count: c.count,
  }));

  return [...groups, ...loose];
}

export function buildInventoryCategories(
  parts: Part[],
  customCategories: CustomCategoryInput[] = [],
): InventoryCategoryDef[] {
  const counts = new Map<string, number>();
  for (const p of parts) {
    const label = displayCategory(p.category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const customByLabel = new Map(
    customCategories.map((c) => [c.label.toLowerCase(), c]),
  );

  const pinnedLabels = new Set(
    basePinned.map((c) => c.matchCategory).filter((x): x is string => Boolean(x)),
  );

  const labels = new Set<string>([...counts.keys()]);
  for (const c of customCategories) labels.add(displayCategory(c.label));

  const groupCounts = buildGroupCounts(parts);
  const groups = groupTiles().map((tile) => {
    const n = tile.group ? groupCounts[tile.group] : 0;
    return {
      ...tile,
      description: `${n} part${n === 1 ? "" : "s"} · pick subtype`,
    };
  });

  const rest = [...labels]
    .filter((c) => !pinnedLabels.has(c))
    .filter((c) => !isGroupedCategory(c))
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

  return [...basePinned, ...groups, ...rest];
}

/** Static snapshot for non-reactive callers (seed / SSR). Prefer useInventory().categories. */
export const inventoryCategories: InventoryCategoryDef[] =
  buildInventoryCategories([]);

export const defaultInventoryCategoryId = "all";
