import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { useCloudState } from "@/lib/cloud-store";
import type { CategoryGroupId } from "@/lib/inventory-categories";
import { categoryGroupIds } from "@/lib/inventory-categories";

export type SavedInventoryView = {
  id: string;
  name: string;
  quickFilter?: string | null;
  categoryId?: string | null;
  search?: string;
};

export type DailyCloseEntry = {
  id: string;
  date: string; // local YYYY-MM-DD
  expectedCash: number;
  expectedOmt: number;
  expectedWhish: number;
  countedCash: number;
  countedOmt: number;
  countedWhish: number;
  note?: string;
  closedAt: string;
};

export type PriceBookEntry = {
  id: string;
  name: string;
  supplierName?: string;
  createdAt: string;
  rows: Array<{ partId: string; partNumber: string; cost: number }>;
};

export type ShiftEntry = {
  id: string;
  openedAt: string;
  closedAt?: string;
  cashierName: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  handoffToName?: string;
  note?: string;
};

type PrefsState = {
  favoritePartIds: string[];
  /** RMB value of one USD, used for operational estimates. */
  rmbPerUsd: number;
  /** ISO timestamp when rmbPerUsd was last changed. */
  rmbPerUsdUpdatedAt?: string;
  /** Saved machine names for quick catalog filter presets. */
  machinePresets: string[];
  /** Pinned category group tiles (Sensors, Switches, …). */
  favoriteCategoryGroups: CategoryGroupId[];
  /** Recently opened category groups, newest first. */
  recentCategoryGroups: CategoryGroupId[];
  /** Custom inventory filter pins. */
  savedInventoryViews: SavedInventoryView[];
  /** Daily cash/OMT/Whish close records (newest first, max 60). */
  dailyCloses: DailyCloseEntry[];
  /** Phone for daily sales WhatsApp digest (E.164 digits ok). */
  digestPhone?: string;
  /** Supplier price books (newest first, max 24). */
  priceBooks: PriceBookEntry[];
  /** Cashier shift handoffs (newest first, max 60). */
  shifts: ShiftEntry[];
  /** ISO timestamp of last China PO WhatsApp draft. */
  lastChinaPoDraftAt?: string;
  /** ISO timestamp of last successful backup download. */
  lastBackupAt?: string;
};

type PrefsContextValue = {
  favoritePartIds: string[];
  rmbPerUsd: number;
  rmbPerUsdUpdatedAt?: string;
  lastBackupAt?: string;
  setRmbPerUsd: (rate: number) => void;
  markBackupDone: () => void;
  machinePresets: string[];
  favoriteCategoryGroups: CategoryGroupId[];
  recentCategoryGroups: CategoryGroupId[];
  savedInventoryViews: SavedInventoryView[];
  addSavedInventoryView: (view: Omit<SavedInventoryView, "id">) => void;
  removeSavedInventoryView: (id: string) => void;
  dailyCloses: DailyCloseEntry[];
  addDailyClose: (entry: Omit<DailyCloseEntry, "id" | "closedAt">) => void;
  removeDailyClose: (id: string) => void;
  digestPhone?: string;
  setDigestPhone: (phone: string) => void;
  priceBooks: PriceBookEntry[];
  addPriceBook: (entry: Omit<PriceBookEntry, "id" | "createdAt">) => void;
  removePriceBook: (id: string) => void;
  shifts: ShiftEntry[];
  startShift: (input: { cashierName: string; openingCash: number; note?: string }) => void;
  endShift: (input: {
    closingCash: number;
    expectedCash?: number;
    handoffToName?: string;
    note?: string;
  }) => void;
  lastChinaPoDraftAt?: string;
  markChinaPoDraftSent: () => void;
  isFavorite: (partId: string) => boolean;
  toggleFavorite: (partId: string) => void;
  addMachinePreset: (machine: string) => void;
  removeMachinePreset: (machine: string) => void;
  isFavoriteCategoryGroup: (groupId: CategoryGroupId) => boolean;
  toggleFavoriteCategoryGroup: (groupId: CategoryGroupId) => void;
  touchRecentCategoryGroup: (groupId: CategoryGroupId) => void;
};

const STORAGE_KEY = "parts-village-prefs-v1";
const RECENT_GROUP_LIMIT = 6;
const DAILY_CLOSE_LIMIT = 60;
const PRICE_BOOK_LIMIT = 24;
const SHIFT_LIMIT = 60;

const PrefsContext = createContext<PrefsContextValue | null>(null);

function isGroupId(v: unknown): v is CategoryGroupId {
  return typeof v === "string" && (categoryGroupIds as string[]).includes(v);
}

function empty(): PrefsState {
  return {
    favoritePartIds: [],
    rmbPerUsd: 7.15,
    machinePresets: [],
    favoriteCategoryGroups: [],
    recentCategoryGroups: [],
    savedInventoryViews: [],
    dailyCloses: [],
    digestPhone: undefined,
    priceBooks: [],
    shifts: [],
  };
}

function isPrefsEmpty(v: PrefsState): boolean {
  return (
    (v.favoritePartIds?.length ?? 0) === 0 &&
    (v.machinePresets?.length ?? 0) === 0 &&
    (v.favoriteCategoryGroups?.length ?? 0) === 0 &&
    (v.recentCategoryGroups?.length ?? 0) === 0 &&
    (v.savedInventoryViews?.length ?? 0) === 0 &&
    (v.dailyCloses?.length ?? 0) === 0 &&
    (v.priceBooks?.length ?? 0) === 0 &&
    (v.shifts?.length ?? 0) === 0 &&
    !v.lastBackupAt &&
    !v.lastChinaPoDraftAt
  );
}

function parseSavedViews(raw: unknown): SavedInventoryView[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedInventoryView[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!id || !name) continue;
    out.push({
      id,
      name,
      quickFilter: typeof r.quickFilter === "string" ? r.quickFilter : null,
      categoryId: typeof r.categoryId === "string" ? r.categoryId : null,
      search: typeof r.search === "string" ? r.search : "",
    });
  }
  return out;
}

function asFiniteNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseDailyCloses(raw: unknown): DailyCloseEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DailyCloseEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const date = typeof r.date === "string" ? r.date.trim() : "";
    const closedAt = typeof r.closedAt === "string" ? r.closedAt : "";
    if (!id || !date || !closedAt) continue;
    out.push({
      id,
      date,
      expectedCash: asFiniteNumber(r.expectedCash),
      expectedOmt: asFiniteNumber(r.expectedOmt),
      expectedWhish: asFiniteNumber(r.expectedWhish),
      countedCash: asFiniteNumber(r.countedCash),
      countedOmt: asFiniteNumber(r.countedOmt),
      countedWhish: asFiniteNumber(r.countedWhish),
      note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined,
      closedAt,
    });
  }
  return out.slice(0, DAILY_CLOSE_LIMIT);
}

function parsePriceBooks(raw: unknown): PriceBookEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PriceBookEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
    if (!id || !name || !createdAt) continue;
    const rowsRaw = Array.isArray(r.rows) ? r.rows : [];
    const rows: PriceBookEntry["rows"] = [];
    for (const item of rowsRaw) {
      if (!item || typeof item !== "object") continue;
      const ir = item as Record<string, unknown>;
      const partId = typeof ir.partId === "string" ? ir.partId : "";
      const partNumber = typeof ir.partNumber === "string" ? ir.partNumber : "";
      if (!partId || !partNumber) continue;
      rows.push({
        partId,
        partNumber,
        cost: asFiniteNumber(ir.cost),
      });
    }
    out.push({
      id,
      name,
      supplierName:
        typeof r.supplierName === "string" && r.supplierName.trim()
          ? r.supplierName.trim()
          : undefined,
      createdAt,
      rows,
    });
  }
  return out.slice(0, PRICE_BOOK_LIMIT);
}

function parseShifts(raw: unknown): ShiftEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ShiftEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const openedAt = typeof r.openedAt === "string" ? r.openedAt : "";
    const cashierName = typeof r.cashierName === "string" ? r.cashierName.trim() : "";
    if (!id || !openedAt || !cashierName) continue;
    out.push({
      id,
      openedAt,
      closedAt: typeof r.closedAt === "string" ? r.closedAt : undefined,
      cashierName,
      openingCash: asFiniteNumber(r.openingCash),
      closingCash: r.closingCash != null ? asFiniteNumber(r.closingCash) : undefined,
      expectedCash: r.expectedCash != null ? asFiniteNumber(r.expectedCash) : undefined,
      handoffToName:
        typeof r.handoffToName === "string" && r.handoffToName.trim()
          ? r.handoffToName.trim()
          : undefined,
      note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined,
    });
  }
  return out.slice(0, SHIFT_LIMIT);
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { value: rawStore, setValue: setStore } = useCloudState<PrefsState>(
    "prefs",
    STORAGE_KEY,
    empty(),
    isPrefsEmpty,
  );

  const store: PrefsState = useMemo(
    () => ({
      favoritePartIds: Array.isArray(rawStore.favoritePartIds) ? rawStore.favoritePartIds : [],
      rmbPerUsd:
        Number.isFinite(rawStore.rmbPerUsd) && rawStore.rmbPerUsd > 0 ? rawStore.rmbPerUsd : 7.15,
      rmbPerUsdUpdatedAt:
        typeof rawStore.rmbPerUsdUpdatedAt === "string" ? rawStore.rmbPerUsdUpdatedAt : undefined,
      lastBackupAt: typeof rawStore.lastBackupAt === "string" ? rawStore.lastBackupAt : undefined,
      machinePresets: Array.isArray(rawStore.machinePresets) ? rawStore.machinePresets : [],
      favoriteCategoryGroups: Array.isArray(rawStore.favoriteCategoryGroups)
        ? rawStore.favoriteCategoryGroups.filter(isGroupId)
        : [],
      recentCategoryGroups: Array.isArray(rawStore.recentCategoryGroups)
        ? rawStore.recentCategoryGroups.filter(isGroupId)
        : [],
      savedInventoryViews: parseSavedViews(rawStore.savedInventoryViews),
      dailyCloses: parseDailyCloses(rawStore.dailyCloses),
      digestPhone:
        typeof rawStore.digestPhone === "string" ? rawStore.digestPhone.trim() || undefined : undefined,
      priceBooks: parsePriceBooks(rawStore.priceBooks),
      shifts: parseShifts(rawStore.shifts),
      lastChinaPoDraftAt:
        typeof rawStore.lastChinaPoDraftAt === "string"
          ? rawStore.lastChinaPoDraftAt
          : undefined,
    }),
    [rawStore],
  );

  const isFavorite = useCallback(
    (partId: string) => store.favoritePartIds.includes(partId),
    [store.favoritePartIds],
  );

  const setRmbPerUsd = useCallback(
    (rate: number) => {
      if (!Number.isFinite(rate) || rate <= 0) return;
      setStore((prev) => ({
        ...prev,
        rmbPerUsd: rate,
        rmbPerUsdUpdatedAt: new Date().toISOString(),
      }));
    },
    [setStore],
  );

  const markBackupDone = useCallback(() => {
    setStore((prev) => ({ ...prev, lastBackupAt: new Date().toISOString() }));
  }, [setStore]);

  const toggleFavorite = useCallback((partId: string) => {
    setStore((prev) => {
      const has = prev.favoritePartIds.includes(partId);
      return {
        ...prev,
        favoritePartIds: has
          ? prev.favoritePartIds.filter((id) => id !== partId)
          : [...prev.favoritePartIds, partId],
      };
    });
  }, []);

  const addMachinePreset = useCallback((machine: string) => {
    const t = machine.trim();
    if (!t) return;
    setStore((prev) => {
      if (prev.machinePresets.some((m) => m.toLowerCase() === t.toLowerCase())) {
        return prev;
      }
      return { ...prev, machinePresets: [t, ...prev.machinePresets].slice(0, 24) };
    });
  }, []);

  const removeMachinePreset = useCallback((machine: string) => {
    setStore((prev) => ({
      ...prev,
      machinePresets: prev.machinePresets.filter((m) => m.toLowerCase() !== machine.toLowerCase()),
    }));
  }, []);

  const addSavedInventoryView = useCallback(
    (view: Omit<SavedInventoryView, "id">) => {
      const name = view.name.trim();
      if (!name) return;
      setStore((prev) => {
        const existing = Array.isArray(prev.savedInventoryViews) ? prev.savedInventoryViews : [];
        const id = `view-${Date.now().toString(36)}`;
        return {
          ...prev,
          savedInventoryViews: [
            {
              id,
              name,
              quickFilter: view.quickFilter ?? null,
              categoryId: view.categoryId ?? null,
              search: view.search?.trim() || "",
            },
            ...existing,
          ].slice(0, 12),
        };
      });
    },
    [setStore],
  );

  const removeSavedInventoryView = useCallback(
    (id: string) => {
      setStore((prev) => ({
        ...prev,
        savedInventoryViews: (prev.savedInventoryViews ?? []).filter((v) => v.id !== id),
      }));
    },
    [setStore],
  );

  const addDailyClose = useCallback(
    (entry: Omit<DailyCloseEntry, "id" | "closedAt">) => {
      const date = entry.date.trim();
      if (!date) return;
      setStore((prev) => {
        const existing = Array.isArray(prev.dailyCloses) ? prev.dailyCloses : [];
        const id = `close-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const next: DailyCloseEntry = {
          id,
          date,
          expectedCash: asFiniteNumber(entry.expectedCash),
          expectedOmt: asFiniteNumber(entry.expectedOmt),
          expectedWhish: asFiniteNumber(entry.expectedWhish),
          countedCash: asFiniteNumber(entry.countedCash),
          countedOmt: asFiniteNumber(entry.countedOmt),
          countedWhish: asFiniteNumber(entry.countedWhish),
          note: entry.note?.trim() || undefined,
          closedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          dailyCloses: [next, ...existing].slice(0, DAILY_CLOSE_LIMIT),
        };
      });
    },
    [setStore],
  );

  const removeDailyClose = useCallback(
    (id: string) => {
      setStore((prev) => ({
        ...prev,
        dailyCloses: (prev.dailyCloses ?? []).filter((v) => v.id !== id),
      }));
    },
    [setStore],
  );

  const setDigestPhone = useCallback(
    (phone: string) => {
      setStore((prev) => ({
        ...prev,
        digestPhone: phone.trim() || undefined,
      }));
    },
    [setStore],
  );

  const addPriceBook = useCallback(
    (entry: Omit<PriceBookEntry, "id" | "createdAt">) => {
      const name = entry.name.trim();
      if (!name) return;
      setStore((prev) => {
        const existing = Array.isArray(prev.priceBooks) ? prev.priceBooks : [];
        const id = `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const rows = (entry.rows ?? [])
          .filter((r) => r.partId && r.partNumber)
          .map((r) => ({
            partId: r.partId,
            partNumber: r.partNumber,
            cost: asFiniteNumber(r.cost),
          }));
        const next: PriceBookEntry = {
          id,
          name,
          supplierName: entry.supplierName?.trim() || undefined,
          createdAt: new Date().toISOString(),
          rows,
        };
        return {
          ...prev,
          priceBooks: [next, ...existing].slice(0, PRICE_BOOK_LIMIT),
        };
      });
    },
    [setStore],
  );

  const removePriceBook = useCallback(
    (id: string) => {
      setStore((prev) => ({
        ...prev,
        priceBooks: (prev.priceBooks ?? []).filter((v) => v.id !== id),
      }));
    },
    [setStore],
  );

  const startShift = useCallback(
    (input: { cashierName: string; openingCash: number; note?: string }) => {
      const cashierName = input.cashierName.trim();
      if (!cashierName) return;
      setStore((prev) => {
        const existing = Array.isArray(prev.shifts) ? prev.shifts : [];
        if (existing.some((s) => !s.closedAt)) return prev;
        const next: ShiftEntry = {
          id: `shift-${Date.now().toString(36)}`,
          openedAt: new Date().toISOString(),
          cashierName,
          openingCash: Math.max(0, input.openingCash),
          note: input.note?.trim() || undefined,
        };
        return { ...prev, shifts: [next, ...existing].slice(0, SHIFT_LIMIT) };
      });
    },
    [setStore],
  );

  const endShift = useCallback(
    (input: {
      closingCash: number;
      expectedCash?: number;
      handoffToName?: string;
      note?: string;
    }) => {
      setStore((prev) => {
        const existing = Array.isArray(prev.shifts) ? prev.shifts : [];
        const openIdx = existing.findIndex((s) => !s.closedAt);
        if (openIdx < 0) return prev;
        const next = [...existing];
        const cur = next[openIdx]!;
        next[openIdx] = {
          ...cur,
          closedAt: new Date().toISOString(),
          closingCash: Math.max(0, input.closingCash),
          expectedCash: input.expectedCash,
          handoffToName: input.handoffToName?.trim() || undefined,
          note: input.note?.trim() || cur.note,
        };
        return { ...prev, shifts: next };
      });
    },
    [setStore],
  );

  const markChinaPoDraftSent = useCallback(() => {
    setStore((prev) => ({ ...prev, lastChinaPoDraftAt: new Date().toISOString() }));
  }, [setStore]);

  const isFavoriteCategoryGroup = useCallback(
    (groupId: CategoryGroupId) => store.favoriteCategoryGroups.includes(groupId),
    [store.favoriteCategoryGroups],
  );

  const toggleFavoriteCategoryGroup = useCallback((groupId: CategoryGroupId) => {
    setStore((prev) => {
      const has = prev.favoriteCategoryGroups.includes(groupId);
      return {
        ...prev,
        favoriteCategoryGroups: has
          ? prev.favoriteCategoryGroups.filter((id) => id !== groupId)
          : [...prev.favoriteCategoryGroups, groupId],
      };
    });
  }, []);

  const touchRecentCategoryGroup = useCallback((groupId: CategoryGroupId) => {
    setStore((prev) => ({
      ...prev,
      recentCategoryGroups: [
        groupId,
        ...prev.recentCategoryGroups.filter((id) => id !== groupId),
      ].slice(0, RECENT_GROUP_LIMIT),
    }));
  }, []);

  const value = useMemo(
    () => ({
      favoritePartIds: store.favoritePartIds,
      rmbPerUsd: store.rmbPerUsd,
      rmbPerUsdUpdatedAt: store.rmbPerUsdUpdatedAt,
      lastBackupAt: store.lastBackupAt,
      setRmbPerUsd,
      markBackupDone,
      machinePresets: store.machinePresets,
      favoriteCategoryGroups: store.favoriteCategoryGroups,
      recentCategoryGroups: store.recentCategoryGroups,
      savedInventoryViews: store.savedInventoryViews,
      addSavedInventoryView,
      removeSavedInventoryView,
      dailyCloses: store.dailyCloses,
      addDailyClose,
      removeDailyClose,
      digestPhone: store.digestPhone,
      setDigestPhone,
      priceBooks: store.priceBooks,
      addPriceBook,
      removePriceBook,
      shifts: store.shifts,
      startShift,
      endShift,
      lastChinaPoDraftAt: store.lastChinaPoDraftAt,
      markChinaPoDraftSent,
      isFavorite,
      toggleFavorite,
      addMachinePreset,
      removeMachinePreset,
      isFavoriteCategoryGroup,
      toggleFavoriteCategoryGroup,
      touchRecentCategoryGroup,
    }),
    [
      store.favoritePartIds,
      store.rmbPerUsd,
      store.rmbPerUsdUpdatedAt,
      store.lastBackupAt,
      setRmbPerUsd,
      markBackupDone,
      store.machinePresets,
      store.favoriteCategoryGroups,
      store.recentCategoryGroups,
      store.savedInventoryViews,
      addSavedInventoryView,
      removeSavedInventoryView,
      store.dailyCloses,
      addDailyClose,
      removeDailyClose,
      store.digestPhone,
      setDigestPhone,
      store.priceBooks,
      addPriceBook,
      removePriceBook,
      store.shifts,
      startShift,
      endShift,
      store.lastChinaPoDraftAt,
      markChinaPoDraftSent,
      isFavorite,
      toggleFavorite,
      addMachinePreset,
      removeMachinePreset,
      isFavoriteCategoryGroup,
      toggleFavoriteCategoryGroup,
      touchRecentCategoryGroup,
    ],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
