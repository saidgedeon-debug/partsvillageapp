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
import { useCloudState } from "@/lib/cloud-store";
import type { Part } from "@/lib/mock-data";
import { buildInventoryCategories, STANDARD_CATEGORY_LABELS, type InventoryCategoryDef } from "@/lib/inventory-categories";

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
    | "subcategory"
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
  /** False until the lazy catalog chunk has loaded AND cloud data is ready. */
  catalogReady: boolean;
  /** True once inventory state has loaded from Supabase. */
  cloudReady: boolean;
  /** Set if loading/saving cloud inventory state failed. */
  cloudError: string | null;
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

function isStoreEmpty(v: StoredState): boolean {
  return (
    Object.keys(v.overrides ?? {}).length === 0 &&
    (v.customParts?.length ?? 0) === 0 &&
    (v.customCategories?.length ?? 0) === 0
  );
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
    subcategory: input.subcategory?.trim() || undefined,
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
  const {
    value: store,
    setValue: setStore,
    ready: cloudReady,
    error: cloudError,
  } = useCloudState<StoredState>("inventory", STORAGE_KEY, emptyStore(), isStoreEmpty);
  const [catalogBase, setCatalogBase] = useState<Part[]>([]);
  const [catalogChunkReady, setCatalogChunkReady] = useState(false);
  const catalogRef = useRef<Part[]>([]);
  const catalogReady = catalogChunkReady && cloudReady;

  useEffect(() => {
    let cancelled = false;
    void loadCatalogParts().then((list) => {
      if (cancelled) return;
      catalogRef.current = list;
      setCatalogBase(list);
      setCatalogChunkReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const overrides = store.overrides ?? {};
  const customParts = store.customParts ?? [];
  const customCategories = store.customCategories ?? [];

  const parts = useMemo(() => {
    const fromCatalog = catalogBase.map((p) => {
      const o = overrides[p.id];
      return o ? applyOverride(p, o) : p;
    });
    const catalogIds = new Set(catalogBase.map((p) => p.id));
    const custom = customParts.filter((p) => !catalogIds.has(p.id));
    return [...fromCatalog, ...custom];
  }, [catalogBase, overrides, customParts]);

  const partsById = useMemo(() => {
    const map = new Map<string, Part>();
    for (const p of parts) map.set(p.id, p);
    return map;
  }, [parts]);

  const categories = useMemo(
    () => buildInventoryCategories(parts, customCategories),
    [parts, customCategories],
  );

  const categoryLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const c of STANDARD_CATEGORY_LABELS) labels.add(c);
    for (const p of parts) labels.add(p.category);
    for (const c of customCategories) labels.add(c.label);
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [parts, customCategories]);

  const getPart = useCallback((id: string) => partsById.get(id), [partsById]);

  const addPart = useCallback((input: PartInput) => {
    const part = normalizePart(input);
    setStore((prev) => ({
      overrides: prev.overrides ?? {},
      customCategories: prev.customCategories ?? [],
      customParts: [...(prev.customParts ?? []), part],
    }));
    return part;
  }, [setStore]);

  const updatePart = useCallback((id: string, patch: PartOverride) => {
    const catalogParts = catalogRef.current;
    const catalogBasePart = catalogParts.find((p) => p.id === id);
    if (catalogBasePart) {
      let merged: Part | null = null;
      setStore((prev) => {
        const prevOverrides = prev.overrides ?? {};
        const nextPatch: PartOverride = { ...prevOverrides[id], ...patch };
        merged = applyOverride(catalogBasePart, nextPatch);
        return {
          ...prev,
          overrides: { ...prevOverrides, [id]: nextPatch },
          customParts: prev.customParts ?? [],
          customCategories: prev.customCategories ?? [],
        };
      });
      return merged;
    }

    let updated: Part | null = null;
    setStore((prev) => {
      const prevCustom = prev.customParts ?? [];
      const idx = prevCustom.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const current = prevCustom[idx];
      updated = normalizePart(
        {
          ...current,
          ...patch,
          partNumber: patch.partNumber ?? current.partNumber,
          name: patch.name ?? current.name,
          category: patch.category ?? current.category,
          subcategory: patch.subcategory ?? current.subcategory,
        },
        id,
      );
      const nextCustom = [...prevCustom];
      nextCustom[idx] = updated;
      return {
        overrides: prev.overrides ?? {},
        customCategories: prev.customCategories ?? [],
        customParts: nextCustom,
      };
    });
    return updated;
  }, [setStore]);

  const bulkUpdateParts = useCallback(
    (
      updates: {
        id: string;
        quantity?: number;
        cost?: number;
        price?: number;
        reorderAt?: number;
      }[],
    ) => {
      let count = 0;
      const catalogParts = catalogRef.current;
      setStore((prev) => {
        const overrides = { ...(prev.overrides ?? {}) };
        const customParts = [...(prev.customParts ?? [])];

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

        return {
          overrides,
          customParts,
          customCategories: prev.customCategories ?? [],
        };
      });
      return count;
    },
    [setStore],
  );

  const removePart = useCallback((id: string) => {
    setStore((prev) => ({
      customCategories: prev.customCategories ?? [],
      customParts: (prev.customParts ?? []).filter((p) => p.id !== id),
      overrides: Object.fromEntries(
        Object.entries(prev.overrides ?? {}).filter(([k]) => k !== id),
      ),
    }));
  }, [setStore]);

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
      const customCategories = prev.customCategories ?? [];
      const customParts = prev.customParts ?? [];
      const exists =
        (STANDARD_CATEGORY_LABELS as readonly string[]).some(
          (c) => c.toLowerCase() === trimmed.toLowerCase(),
        ) ||
        customCategories.some((c) => c.label.toLowerCase() === trimmed.toLowerCase()) ||
        base.some((p) => p.category.toLowerCase() === trimmed.toLowerCase()) ||
        customParts.some((p) => p.category.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        ok = false;
        return prev;
      }
      return {
        overrides: prev.overrides ?? {},
        customParts,
        customCategories: [...customCategories, record],
      };
    });
    return ok ? record : null;
  }, [setStore]);

  const updateCategory = useCallback(
    (id: string, patch: { label?: string; description?: string }) => {
      let result: CategoryRecord | null = null;
      const nextLabel = patch.label?.trim();

      setStore((prev) => {
        const base = catalogRef.current;
        const prevCustomCategories = prev.customCategories ?? [];
        const prevCustomParts = prev.customParts ?? [];
        const prevOverrides = prev.overrides ?? {};
        // Resolve current label from custom list or from built-in match via parts
        const custom = prevCustomCategories.find((c) => c.id === id);
        const allLabels = new Set([
          ...base.map((p) => p.category),
          ...prevCustomParts.map((p) => p.category),
          ...prevCustomCategories.map((c) => c.label),
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
        const overrides = { ...prevOverrides };
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

        const customParts = prevCustomParts.map((p) =>
          p.category === oldLabel ? { ...p, category: label } : p,
        );

        let customCategories = [...prevCustomCategories];
        const existingIdx = customCategories.findIndex((c) => c.id === id || c.label === oldLabel);
        const record: CategoryRecord = {
          id:
            existingIdx >= 0
              ? customCategories[existingIdx].id
              : id.startsWith("cat-")
                ? id
                : `cat-${slug(label)}`,
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
            arr.findIndex((x) => x.label.toLowerCase() === c.label.toLowerCase()) === i,
        );

        result = record;
        return { overrides, customParts, customCategories };
      });

      return result;
    },
    [],
  );

  const removeCategory = useCallback((id: string) => {
    let removed = false;
    setStore((prev) => {
      const customCategories = prev.customCategories ?? [];
      const customParts = prev.customParts ?? [];
      const overrides = prev.overrides ?? {};
      const custom = customCategories.find((c) => c.id === id);
      if (!custom) return prev;
      const base = catalogRef.current;
      const inUse = [
        ...base.map((p) => applyOverride(p, overrides[p.id])),
        ...customParts,
      ].some((p) => p.category === custom.label);
      if (inUse) return prev;
      removed = true;
      return {
        overrides,
        customParts,
        customCategories: customCategories.filter((c) => c.id !== id),
      };
    });
    return removed;
  }, [setStore]);

  const value = useMemo(
    () => ({
      parts,
      categories,
      categoryLabels,
      catalogReady,
      cloudReady,
      cloudError,
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
      cloudReady,
      cloudError,
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

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}
