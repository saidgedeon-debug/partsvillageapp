import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { parts as catalogParts, type Part } from "@/lib/mock-data";
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

type PartOverride = Partial<
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
  getPart: (id: string) => Part | undefined;
  addPart: (input: PartInput) => Part;
  updatePart: (id: string, patch: PartOverride) => Part | null;
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
  };
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoredState>(emptyStore);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(loadStore());
    setHydrated(true);
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
    const fromCatalog = catalogParts.map((p) =>
      applyOverride(p, store.overrides[p.id]),
    );
    const catalogIds = new Set(catalogParts.map((p) => p.id));
    const custom = store.customParts.filter((p) => !catalogIds.has(p.id));
    return [...fromCatalog, ...custom];
  }, [store.overrides, store.customParts]);

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

  const getPart = useCallback(
    (id: string) => parts.find((p) => p.id === id),
    [parts],
  );

  const addPart = useCallback((input: PartInput) => {
    const part = normalizePart(input);
    setStore((prev) => ({
      ...prev,
      customParts: [...prev.customParts, part],
    }));
    return part;
  }, []);

  const updatePart = useCallback((id: string, patch: PartOverride) => {
    const catalogBase = catalogParts.find((p) => p.id === id);
    if (catalogBase) {
      let merged: Part | null = null;
      setStore((prev) => {
        const nextPatch: PartOverride = { ...prev.overrides[id], ...patch };
        merged = applyOverride(catalogBase, nextPatch);
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
      const exists =
        prev.customCategories.some(
          (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
        ) ||
        catalogParts.some((p) => p.category.toLowerCase() === trimmed.toLowerCase()) ||
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
        // Resolve current label from custom list or from built-in match via parts
        const custom = prev.customCategories.find((c) => c.id === id);
        const allLabels = new Set([
          ...catalogParts.map((p) => p.category),
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
          for (const base of catalogParts) {
            const current = applyOverride(base, overrides[base.id]);
            if (current.category === oldLabel) {
              overrides[base.id] = {
                ...overrides[base.id],
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
      const inUse = [
        ...catalogParts.map((p) => applyOverride(p, prev.overrides[p.id])),
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
      getPart,
      addPart,
      updatePart,
      removePart,
      addCategory,
      updateCategory,
      removeCategory,
    }),
    [
      parts,
      categories,
      categoryLabels,
      getPart,
      addPart,
      updatePart,
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
