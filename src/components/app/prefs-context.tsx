import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CategoryGroupId } from "@/lib/inventory-categories";
import { categoryGroupIds } from "@/lib/inventory-categories";
import { loadJson, saveJson } from "@/lib/storage";

type PrefsState = {
  favoritePartIds: string[];
  /** Saved machine names for quick catalog filter presets. */
  machinePresets: string[];
  /** Pinned category group tiles (Sensors, Switches, …). */
  favoriteCategoryGroups: CategoryGroupId[];
  /** Recently opened category groups, newest first. */
  recentCategoryGroups: CategoryGroupId[];
};

type PrefsContextValue = {
  favoritePartIds: string[];
  machinePresets: string[];
  favoriteCategoryGroups: CategoryGroupId[];
  recentCategoryGroups: CategoryGroupId[];
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
    machinePresets: [],
    favoriteCategoryGroups: [],
    recentCategoryGroups: [],
  };
}

function loadPrefs(): PrefsState {
  const raw = loadJson<Partial<PrefsState>>(STORAGE_KEY, empty());
  return {
    favoritePartIds: Array.isArray(raw.favoritePartIds) ? raw.favoritePartIds : [],
    machinePresets: Array.isArray(raw.machinePresets) ? raw.machinePresets : [],
    favoriteCategoryGroups: Array.isArray(raw.favoriteCategoryGroups)
      ? raw.favoriteCategoryGroups.filter(isGroupId)
      : [],
    recentCategoryGroups: Array.isArray(raw.recentCategoryGroups)
      ? raw.recentCategoryGroups.filter(isGroupId)
      : [],
  };
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<PrefsState>(() => loadPrefs());

  useEffect(() => {
    saveJson(STORAGE_KEY, store);
  }, [store]);

  const isFavorite = useCallback(
    (partId: string) => store.favoritePartIds.includes(partId),
    [store.favoritePartIds],
  );

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
      machinePresets: prev.machinePresets.filter(
        (m) => m.toLowerCase() !== machine.toLowerCase(),
      ),
    }));
  }, []);

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
      machinePresets: store.machinePresets,
      favoriteCategoryGroups: store.favoriteCategoryGroups,
      recentCategoryGroups: store.recentCategoryGroups,
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
      store.machinePresets,
      store.favoriteCategoryGroups,
      store.recentCategoryGroups,
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
