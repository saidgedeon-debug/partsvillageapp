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
  };
}

function isPrefsEmpty(v: PrefsState): boolean {
  return (
    (v.favoritePartIds?.length ?? 0) === 0 &&
    (v.machinePresets?.length ?? 0) === 0 &&
    (v.favoriteCategoryGroups?.length ?? 0) === 0 &&
    (v.recentCategoryGroups?.length ?? 0) === 0 &&
    (v.savedInventoryViews?.length ?? 0) === 0 &&
    !v.lastBackupAt
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
