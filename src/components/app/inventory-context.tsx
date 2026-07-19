import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { loadCatalogParts } from "@/lib/catalog-loader";
import type { Part } from "@/lib/mock-data";
import {
  buildInventoryCategories,
  type InventoryCategoryDef,
} from "@/lib/inventory-categories";

export type PartInput = Partial<Part> & {
  partNumber: string;
  name: string;
  category: string;
};

export type CategoryRecord = {
  id: string;
  label: string;
  description?: string;
};

export type PartOverride = Partial<
  Pick<
    Part,
    | "partNumber"
    | "partNumbers"
    | "name"
    | "category"
    | "quantity"
    | "reorderAt"
    | "cost"
    | "price"
    | "compatibility"
    | "boxNumber"
    | "insideDiameterMm"
    | "crossSectionMm"
    | "notes"
    | "imageUrl"
  >
>;

type StoredState = {
  overrides: Record<string, PartOverride>;
  customParts: Part[];
  customCategories: CategoryRecord[];
};

type InventoryContextValue = {
  parts: Part[];
  categories: InventoryCategoryDef[];
  categoryLabels: string[];
  /** False until the lazy catalog chunk has loaded. */
  catalogReady: boolean;
  getPart: (id: string) => Part | undefined;
  addPart: (input: PartInput) => Part;
  updatePart: (id: string, patch: PartOverride) => Part | null;
  bulkUpdateParts: (
    updates: {
      id: string;
      quantity?: number;
      cost?: number;
      price?: number;
      reorderAt?: number;
    }[],
  ) => number;
  removePart: (id: string) => void;
  addCategory: (label: string, description?: string) => CategoryRecord | null;
  updateCategory: (
    id: string,
    patch: { label?: string; description?: string },
  ) => CategoryRecord | null;
  removeCategory: (id: string) => boolean;
};

const STORAGE_KEY = "parts-village-inventory-v2";
const LEGACY_OVERRIDES_KEY = "parts-village-inventory-overrides-v1";

const InventoryContext = createContext<InventoryContextValue | null>(null);

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function slug(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function emptyStore(): StoredState {
  return { overrides: {}, customParts: [], customCategories: [] };
}

function loadStore(): StoredState {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      return {
        overrides: parsed.overrides ?? {},
        customParts: Array.isArray(parsed.customParts) ? parsed.customParts : [],
        customCategories: Array.isArray(parsed.customCategories)
          ? parsed.customCategories
          : [],
      };
    }
    // migrate v1 overrides
    const legacy = localStorage.getItem(LEGACY_OVERRIDES_KEY);
    if (legacy) {
      const overrides = JSON.parse(legacy) as Record<string, PartOverride>;
      return { overrides: overrides ?? {}, customParts: [], customCategories: [] };
    }
  } catch {
    // fall through
  }
  return emptyStore();
}

function applyOverride(base: Part, override?: PartOverride): Part {
  if (!override) return base;
  return {
    ...base,
    ...override,
    compatibility: override.compatibility ?? base.compatibility,
    partNumbers: override.partNumbers ?? base.partNumbers,
  };
}

function normalizePart(input: PartInput, id?: string): Part {
  const numbers =
    input.partNumbers?.length && input.partNumbers.some((n) => n.trim())
      ? input.partNumbers.map((n) => n.trim()).filter(Boolean)
      : [input.partNumber.trim()];
  return {
    id: id ?? input.id ?? newId("part"),
    partNumber: numbers[0],
    partNumbers: numbers,
    name: (input.name || numbers[0]).trim(),
    category: input.category.trim(),
    quantity: Number.isFinite(input.quantity) ? Number(input.quantity) : 0,
    reorderAt: Number.isFinite(input.reorderAt) ? Number(input.reorderAt) : 0,
    cost: Number.isFinite(input.cost) ? Number(input.cost) : 0,
    price: Number.isFinite(input.price) ? Number(input.price) : 0,
    compatibility: input.compatibility ?? [],
    boxNumber: input.boxNumber,
    insideDiameterMm: input.insideDiameterMm,
    crossSectionMm: input.crossSectionMm,
    notes: input.notes,
    imageUrl: input.imageUrl,
  };
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoredState>(emptyStore);
  const [hydrated, setHydrated] = useState(false);
  const [catalogBase, setCatalogBase] = useState<Part[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const catalogRef = useRef<Part[]>([]);

  useEffect(() => {
    setStore(loadStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCatalogParts().then((list) => {
      if (cancelled) return;
      catalogRef.current = list;
      setCatalogBase(list);
      setCatalogReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore quota
    }
  }, [store, hydrated]);

  const parts = useMemo(() => {
    const overrides = store.overrides;
    const fromCatalog = catalogBase.map((p) => {
      const o = overrides[p.id];
      return o ? applyOverride(p, o) : p;
    });
    const catalogIds = new Set(catalogBase.map((p) => p.id));
    const custom = store.customParts.filter((p) => !catalogIds.has(p.id));
    return [...fromCatalog, ...custom];
  }, [catalogBase, store.overrides, store.customParts]);

  const partsById = useMemo(() => {
    const map = new Map<string, Part>();
    for (const p of parts) map.set(p.id, p);
    return map;
  }, [parts]);

  const categories = useMemo(
    () => buildInventoryCategories(parts, store.customCategories),
    [parts, store.customCategories],
  );

  const categoryLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const p of parts) labels.add(p.category);
    for (const c of store.customCategories) labels.add(c.label);
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [parts, store.customCategories]);

  const getPart = useCallback((id: string) => partsById.get(id), [partsById]);

  const addPart = useCallback((input: PartInput) => {
    const part = normalizePart(input);
    setStore((prev) => ({
      ...prev,
      customParts: [...prev.customParts, part],
    }));
    return part;
  }, []);

  const updatePart = useCallback((id: string, patch: PartOverride) => {
    const catalogParts = catalogRef.current;
    const catalogBasePart = catalogParts.find((p) => p.id === id);
    if (catalogBasePart) {
      let merged: Part | null = null;
      setStore((prev) => {
        const nextPatch: PartOverride = { ...prev.overrides[id], ...patch };
        merged = applyOverride(catalogBasePart, nextPatch);
        return {
          ...prev,
          overrides: { ...prev.overrides, [id]: nextPatch },
        };
      });
      return merged;
    }

    let updated: Part | null = null;
    setStore((prev) => {
      const idx = prev.customParts.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const current = prev.customParts[idx];
      updated = normalizePart(
        {
          ...current,
          ...patch,
          partNumber: patch.partNumber ?? current.partNumber,
          name: patch.name ?? current.name,
          category: patch.category ?? current.category,
        },
        id,
      );
      const customParts = [...prev.customParts];
      customParts[idx] = updated;
      return { ...prev, customParts };
    });
    return updated;
  }, []);

  const bulkUpdateParts = useCallback(
    (updates: {
      id: string;
      quantity?: number;
      cost?: number;
      price?: number;
      reorderAt?: number;
    }[]) => {
      let count = 0;
      const catalogParts = catalogRef.current;
      setStore((prev) => {
        let overrides = { ...prev.overrides };
        let customParts = [...prev.customParts];

        for (const u of updates) {
          const patch: PartOverride = {};
          if (u.quantity !== undefined && Number.isFinite(u.quantity)) {
            patch.quantity = Math.max(0, Math.round(u.quantity));
          }
          if (u.cost !== undefined && Number.isFinite(u.cost)) {
            patch.cost = Math.max(0, u.cost);
          }
          if (u.price !== undefined && Number.isFinite(u.price)) {
            patch.price = Math.max(0, u.price);
          }
          if (u.reorderAt !== undefined && Number.isFinite(u.reorderAt)) {
            patch.reorderAt = Math.max(0, Math.round(u.reorderAt));
          }
          if (Object.keys(patch).length === 0) continue;

          const catalogBasePart = catalogParts.find((p) => p.id === u.id);
          if (catalogBasePart) {
            overrides[u.id] = { ...overrides[u.id], ...patch };
            count += 1;
            continue;
          }
          const idx = customParts.findIndex((p) => p.id === u.id);
          if (idx >= 0) {
            customParts[idx] = { ...customParts[idx], ...patch };
            count += 1;
          }
        }

        return { ...prev, overrides, customParts };
      });
      return count;
    },
    [],
  );

  const removePart = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      customParts: prev.customParts.filter((p) => p.id !== id),
      overrides: Object.fromEntries(
        Object.entries(prev.overrides).filter(([k]) => k !== id),
      ),
    }));
  }, []);

  const addCategory = useCallback((label: string, description?: string) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const id = `cat-${slug(trimmed) || newId("cat")}`;
    const record: CategoryRecord = {
      id,
      label: trimmed,
      description: description?.trim() || undefined,
    };

    let ok = true;
    setStore((prev) => {
      const base = catalogRef.current;
      const exists =
        prev.customCategories.some(
          (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
        ) ||
        base.some((p) => p.category.toLowerCase() === trimmed.toLowerCase()) ||
        prev.customParts.some((p) => p.category.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        ok = false;
        return prev;
      }
      return {
        ...prev,
        customCategories: [...prev.customCategories, record],
      };
    });
    return ok ? record : null;
  }, []);

  const updateCategory = useCallback(
    (id: string, patch: { label?: string; description?: string }) => {
      let result: CategoryRecord | null = null;
      const nextLabel = patch.label?.trim();

      setStore((prev) => {
        const base = catalogRef.current;
        // Resolve current label from custom list or from built-in match via parts
        const custom = prev.customCategories.find((c) => c.id === id);
        const allLabels = new Set([
          ...base.map((p) => p.category),
          ...prev.customParts.map((p) => p.category),
          ...prev.customCategories.map((c) => c.label),
        ]);

        let oldLabel = custom?.label;
        if (!oldLabel) {
          // id may be slug of a part-derived category
          for (const label of allLabels) {
            if (slug(label) === id || `cat-${slug(label)}` === id) {
              oldLabel = label;
              break;
            }
          }
        }
        if (!oldLabel) return prev;

        const label = nextLabel || oldLabel;
        if (!label) return prev;

        // Remap parts when renaming
        const overrides = { ...prev.overrides };
        if (label !== oldLabel) {
          for (const basePart of base) {
            const current = applyOverride(basePart, overrides[basePart.id]);
            if (current.category === oldLabel) {
              overrides[basePart.id] = {
                ...overrides[basePart.id],
                category: label,
              };
            }
          }
        }

        const customParts = prev.customParts.map((p) =>
          p.category === oldLabel ? { ...p, category: label } : p,
        );

        let customCategories = [...prev.customCategories];
        const existingIdx = customCategories.findIndex(
          (c) => c.id === id || c.label === oldLabel,
        );
        const record: CategoryRecord = {
          id: existingIdx >= 0 ? customCategories[existingIdx].id : id.startsWith("cat-") ? id : `cat-${slug(label)}`,
          label,
          description:
            patch.description !== undefined
              ? patch.description.trim() || undefined
              : custom?.description,
        };
        if (existingIdx >= 0) {
          customCategories[existingIdx] = record;
        } else {
          customCategories.push(record);
        }
        // drop duplicate labels
        customCategories = customCategories.filter(
          (c, i, arr) =>
            arr.findIndex((x) => x.label.toLowerCase() === c.label.toLowerCase()) ===
            i,
        );

        result = record;
        return { ...prev, overrides, customParts, customCategories };
      });

      return result;
    },
    [],
  );

  const removeCategory = useCallback((id: string) => {
    let removed = false;
    setStore((prev) => {
      const custom = prev.customCategories.find((c) => c.id === id);
      if (!custom) return prev;
      const base = catalogRef.current;
      const inUse = [
        ...base.map((p) => applyOverride(p, prev.overrides[p.id])),
        ...prev.customParts,
      ].some((p) => p.category === custom.label);
      if (inUse) return prev;
      removed = true;
      return {
        ...prev,
        customCategories: prev.customCategories.filter((c) => c.id !== id),
      };
    });
    return removed;
  }, []);

  const value = useMemo(
    () => ({
      parts,
      categories,
      categoryLabels,
      catalogReady,
      getPart,
      addPart,
      updatePart,
      bulkUpdateParts,
      removePart,
      addCategory,
      updateCategory,
      removeCategory,
    }),
    [
      parts,
      categories,
      categoryLabels,
      catalogReady,
      getPart,
      addPart,
      updatePart,
      bulkUpdateParts,
      removePart,
      addCategory,
      updateCategory,
      removeCategory,
    ],
  );

  return (
    <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}
