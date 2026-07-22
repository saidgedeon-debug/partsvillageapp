import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { useCloudState } from "@/lib/cloud-store";
import { newLocalId } from "@/lib/storage";

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

function isKitsEmpty(v: PartKit[]): boolean {
  return (v?.length ?? 0) === 0;
}

export function KitsProvider({ children }: { children: ReactNode }) {
  const { value: kits, setValue: setKits } = useCloudState<PartKit[]>(
    "kits",
    STORAGE_KEY,
    [],
    isKitsEmpty,
  );

  const safeKits = Array.isArray(kits) ? kits : [];

  const addKit = useCallback(
    (input: Omit<PartKit, "id"> & { id?: string }) => {
      const kit: PartKit = {
        id: input.id ?? newLocalId("kit"),
        name: input.name.trim(),
        machine: input.machine?.trim() || undefined,
        partIds: [...new Set(input.partIds)],
      };
      setKits((prev) => [kit, ...(Array.isArray(prev) ? prev : [])]);
      return kit;
    },
    [setKits],
  );

  const updateKit = useCallback(
    (id: string, patch: Partial<PartKit>) => {
      setKits((prev) =>
        (Array.isArray(prev) ? prev : []).map((k) =>
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
    },
    [setKits],
  );

  const removeKit = useCallback(
    (id: string) => {
      setKits((prev) => (Array.isArray(prev) ? prev : []).filter((k) => k.id !== id));
    },
    [setKits],
  );

  const value = useMemo(
    () => ({ kits: safeKits, addKit, updateKit, removeKit }),
    [safeKits, addKit, updateKit, removeKit],
  );

  return <KitsContext.Provider value={value}>{children}</KitsContext.Provider>;
}

export function useKits() {
  const ctx = useContext(KitsContext);
  if (!ctx) throw new Error("useKits must be used within KitsProvider");
  return ctx;
}
