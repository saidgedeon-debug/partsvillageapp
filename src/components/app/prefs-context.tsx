import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadJson, saveJson } from "@/lib/storage";

type PrefsState = {
  favoritePartIds: string[];
  /** Saved machine names for quick catalog filter presets. */
  machinePresets: string[];
};

type PrefsContextValue = {
  favoritePartIds: string[];
  machinePresets: string[];
  isFavorite: (partId: string) => boolean;
  toggleFavorite: (partId: string) => void;
  addMachinePreset: (machine: string) => void;
  removeMachinePreset: (machine: string) => void;
};

const STORAGE_KEY = "parts-village-prefs-v1";

const PrefsContext = createContext<PrefsContextValue | null>(null);

function empty(): PrefsState {
  return { favoritePartIds: [], machinePresets: [] };
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<PrefsState>(() =>
    loadJson<PrefsState>(STORAGE_KEY, empty()),
  );

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

  const value = useMemo(
    () => ({
      favoritePartIds: store.favoritePartIds,
      machinePresets: store.machinePresets,
      isFavorite,
      toggleFavorite,
      addMachinePreset,
      removeMachinePreset,
    }),
    [
      store.favoritePartIds,
      store.machinePresets,
      isFavorite,
      toggleFavorite,
      addMachinePreset,
      removeMachinePreset,
    ],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
