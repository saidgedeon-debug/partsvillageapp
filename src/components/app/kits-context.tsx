import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadJson, newLocalId, saveJson } from "@/lib/storage";

export type PartKit = {
  id: string;
  name: string;
  /** Optional machine label for the kit. */
  machine?: string;
  partIds: string[];
};

type KitsContextValue = {
  kits: PartKit[];
  addKit: (input: Omit<PartKit, "id"> & { id?: string }) => PartKit;
  updateKit: (id: string, patch: Partial<PartKit>) => void;
  removeKit: (id: string) => void;
};

const STORAGE_KEY = "parts-village-kits-v1";

const KitsContext = createContext<KitsContextValue | null>(null);

export function KitsProvider({ children }: { children: ReactNode }) {
  const [kits, setKits] = useState<PartKit[]>(() =>
    loadJson<PartKit[]>(STORAGE_KEY, []),
  );

  useEffect(() => {
    saveJson(STORAGE_KEY, kits);
  }, [kits]);

  const addKit = useCallback((input: Omit<PartKit, "id"> & { id?: string }) => {
    const kit: PartKit = {
      id: input.id ?? newLocalId("kit"),
      name: input.name.trim(),
      machine: input.machine?.trim() || undefined,
      partIds: [...new Set(input.partIds)],
    };
    setKits((prev) => [kit, ...prev]);
    return kit;
  }, []);

  const updateKit = useCallback((id: string, patch: Partial<PartKit>) => {
    setKits((prev) =>
      prev.map((k) =>
        k.id === id
          ? {
              ...k,
              ...patch,
              id: k.id,
              partIds: patch.partIds ? [...new Set(patch.partIds)] : k.partIds,
            }
          : k,
      ),
    );
  }, []);

  const removeKit = useCallback((id: string) => {
    setKits((prev) => prev.filter((k) => k.id !== id));
  }, []);

  const value = useMemo(
    () => ({ kits, addKit, updateKit, removeKit }),
    [kits, addKit, updateKit, removeKit],
  );

  return <KitsContext.Provider value={value}>{children}</KitsContext.Provider>;
}

export function useKits() {
  const ctx = useContext(KitsContext);
  if (!ctx) throw new Error("useKits must be used within KitsProvider");
  return ctx;
}
