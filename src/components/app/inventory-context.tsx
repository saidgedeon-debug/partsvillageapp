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

type InventoryContextValue = {
  parts: Part[];
  getPart: (id: string) => Part | undefined;
  updatePart: (id: string, patch: PartOverride) => Part | null;
};

const STORAGE_KEY = "parts-village-inventory-overrides-v1";

const InventoryContext = createContext<InventoryContextValue | null>(null);

function loadOverrides(): Record<string, PartOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PartOverride>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function applyOverride(base: Part, override?: PartOverride): Part {
  if (!override) return base;
  return {
    ...base,
    ...override,
    compatibility: override.compatibility ?? base.compatibility,
  };
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, PartOverride>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOverrides(loadOverrides());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // ignore quota errors
    }
  }, [overrides, hydrated]);

  const parts = useMemo(
    () => catalogParts.map((p) => applyOverride(p, overrides[p.id])),
    [overrides],
  );

  const getPart = useCallback(
    (id: string) => {
      const base = catalogParts.find((p) => p.id === id);
      if (!base) return undefined;
      return applyOverride(base, overrides[id]);
    },
    [overrides],
  );

  const updatePart = useCallback((id: string, patch: PartOverride) => {
    const base = catalogParts.find((p) => p.id === id);
    if (!base) return null;

    let merged: Part | null = null;
    setOverrides((prev) => {
      const nextPatch: PartOverride = { ...prev[id], ...patch };
      merged = applyOverride(base, nextPatch);
      return { ...prev, [id]: nextPatch };
    });
    return merged;
  }, []);

  const value = useMemo(
    () => ({ parts, getPart, updatePart }),
    [parts, getPart, updatePart],
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
