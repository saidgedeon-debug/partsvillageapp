import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { useCloudState } from "@/lib/cloud-store";

export type ShareItemKind =
  | "quotation"
  | "invoice"
  | "order-paper"
  | "other"
  | "unassigned";

export type ShareInboxItem = {
  id: string;
  name: string;
  /** image/jpeg data URL or PDF data URL */
  dataUrl: string;
  mimeType: string;
  kind: ShareItemKind;
  /** Linked China shipment after assign */
  shipmentId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

type ShareInboxContextValue = {
  items: ShareInboxItem[];
  pendingCount: number;
  addItems: (
    files: Array<{
      name: string;
      dataUrl: string;
      mimeType: string;
      kind?: ShareItemKind;
    }>,
  ) => ShareInboxItem[];
  updateItem: (
    id: string,
    patch: Partial<Pick<ShareInboxItem, "kind" | "shipmentId" | "note" | "name">>,
  ) => void;
  removeItem: (id: string) => void;
  clearAssigned: () => void;
};

const STORAGE_KEY = "parts-village-share-inbox-v1";

const ShareInboxContext = createContext<ShareInboxContextValue | null>(null);

function newId() {
  return `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isEmpty(v: ShareInboxItem[]): boolean {
  return (v?.length ?? 0) === 0;
}

export function ShareInboxProvider({ children }: { children: ReactNode }) {
  const { value: items, setValue: setItems } = useCloudState<ShareInboxItem[]>(
    "share-inbox",
    STORAGE_KEY,
    [],
    isEmpty,
  );

  const list = Array.isArray(items) ? items : [];

  const addItems = useCallback(
    (
      files: Array<{
        name: string;
        dataUrl: string;
        mimeType: string;
        kind?: ShareItemKind;
      }>,
    ) => {
      const now = new Date().toISOString();
      const created: ShareInboxItem[] = files.map((f) => ({
        id: newId(),
        name: f.name.trim() || "Shared file",
        dataUrl: f.dataUrl,
        mimeType: f.mimeType || "application/octet-stream",
        kind: f.kind ?? "unassigned",
        createdAt: now,
        updatedAt: now,
      }));
      setItems((prev) => [...created, ...(Array.isArray(prev) ? prev : [])]);
      return created;
    },
    [setItems],
  );

  const updateItem = useCallback(
    (
      id: string,
      patch: Partial<Pick<ShareInboxItem, "kind" | "shipmentId" | "note" | "name">>,
    ) => {
      setItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((it) =>
          it.id !== id
            ? it
            : {
                ...it,
                ...patch,
                name: patch.name !== undefined ? patch.name.trim() || it.name : it.name,
                note:
                  patch.note !== undefined ? patch.note.trim() || undefined : it.note,
                updatedAt: new Date().toISOString(),
              },
        ),
      );
    },
    [setItems],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => (Array.isArray(prev) ? prev : []).filter((it) => it.id !== id));
    },
    [setItems],
  );

  const clearAssigned = useCallback(() => {
    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).filter(
        (it) => it.kind === "unassigned" || !it.shipmentId,
      ),
    );
  }, [setItems]);

  const pendingCount = list.filter((it) => it.kind === "unassigned").length;

  const value = useMemo(
    () => ({
      items: list,
      pendingCount,
      addItems,
      updateItem,
      removeItem,
      clearAssigned,
    }),
    [list, pendingCount, addItems, updateItem, removeItem, clearAssigned],
  );

  return <ShareInboxContext.Provider value={value}>{children}</ShareInboxContext.Provider>;
}

export function useShareInbox() {
  const ctx = useContext(ShareInboxContext);
  if (!ctx) throw new Error("useShareInbox must be used within ShareInboxProvider");
  return ctx;
}

export const SHARE_KIND_LABELS: Record<ShareItemKind, string> = {
  unassigned: "Choose type…",
  quotation: "New order quotation",
  invoice: "Supplier invoice",
  "order-paper": "China order / shipping paper",
  other: "Other",
};
