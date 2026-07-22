import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { useCloudState } from "@/lib/cloud-store";

export type ShipmentStatus =
  | "Ordered"
  | "In transit"
  | "Arrived"
  | "In stock"
  | "Cancelled";

export type ShipmentAttachment = {
  id: string;
  name: string;
  /** Compressed JPEG data URL */
  dataUrl: string;
  kind: "invoice" | "paper" | "other";
  createdAt: string;
};

export type ChinaShipment = {
  id: string;
  title: string;
  supplier: string;
  orderedAt: string;
  expectedAt?: string;
  arrivedAt?: string;
  /** Titus / carrier shipment number (e.g. GZ20…) */
  trackingNumber?: string;
  status: ShipmentStatus;
  notes?: string;
  /** Goods cost */
  totalCost?: number;
  currency: "USD" | "RMB";
  /** Titus Logistics freight details */
  freightMode?: "Air" | "Sea LCL" | "Sea FCL" | "Other";
  freightCost?: number;
  freightCurrency?: "USD" | "RMB";
  weightKg?: number;
  volumeCbm?: number;
  cartons?: number;
  /** Last location / status copied from Titus app */
  titusLocation?: string;
  attachments: ShipmentAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type ShipmentInput = {
  title: string;
  supplier?: string;
  orderedAt: string;
  expectedAt?: string;
  arrivedAt?: string;
  trackingNumber?: string;
  status: ShipmentStatus;
  notes?: string;
  totalCost?: number;
  currency?: "USD" | "RMB";
  freightMode?: ChinaShipment["freightMode"];
  freightCost?: number;
  freightCurrency?: "USD" | "RMB";
  weightKg?: number;
  volumeCbm?: number;
  cartons?: number;
  titusLocation?: string;
};

type ShipmentsContextValue = {
  shipments: ChinaShipment[];
  getShipment: (id: string) => ChinaShipment | undefined;
  addShipment: (input: ShipmentInput) => ChinaShipment;
  updateShipment: (id: string, patch: Partial<ShipmentInput>) => ChinaShipment | null;
  removeShipment: (id: string) => void;
  addAttachment: (
    shipmentId: string,
    file: { name: string; dataUrl: string; kind: ShipmentAttachment["kind"] },
  ) => ShipmentAttachment | null;
  removeAttachment: (shipmentId: string, attachmentId: string) => void;
};

const STORAGE_KEY = "parts-village-shipments-v1";

const ShipmentsContext = createContext<ShipmentsContextValue | null>(null);

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isEmpty(v: ChinaShipment[]): boolean {
  return (v?.length ?? 0) === 0;
}

export function ShipmentsProvider({ children }: { children: ReactNode }) {
  const { value: shipments, setValue: setShipments } = useCloudState<ChinaShipment[]>(
    "shipments",
    STORAGE_KEY,
    [],
    isEmpty,
  );

  const list = Array.isArray(shipments) ? shipments : [];

  const getShipment = useCallback(
    (id: string) => list.find((s) => s.id === id),
    [list],
  );

  const addShipment = useCallback(
    (input: ShipmentInput) => {
      const now = new Date().toISOString();
      const row: ChinaShipment = {
        id: newId("ship"),
        title: input.title.trim(),
        supplier: (input.supplier ?? "").trim(),
        orderedAt: input.orderedAt,
        expectedAt: input.expectedAt || undefined,
        arrivedAt: input.arrivedAt || undefined,
        trackingNumber: input.trackingNumber?.trim() || undefined,
        status: input.status,
        notes: input.notes?.trim() || undefined,
        totalCost: Number.isFinite(input.totalCost) ? input.totalCost : undefined,
        currency: input.currency ?? "USD",
        freightMode: input.freightMode,
        freightCost: Number.isFinite(input.freightCost) ? input.freightCost : undefined,
        freightCurrency: input.freightCurrency ?? "USD",
        weightKg: Number.isFinite(input.weightKg) ? input.weightKg : undefined,
        volumeCbm: Number.isFinite(input.volumeCbm) ? input.volumeCbm : undefined,
        cartons: Number.isFinite(input.cartons) ? input.cartons : undefined,
        titusLocation: input.titusLocation?.trim() || undefined,
        attachments: [],
        createdAt: now,
        updatedAt: now,
      };
      setShipments((prev) => [row, ...(Array.isArray(prev) ? prev : [])]);
      return row;
    },
    [setShipments],
  );

  const updateShipment = useCallback(
    (id: string, patch: Partial<ShipmentInput>) => {
      let updated: ChinaShipment | null = null;
      const num = (v: number | undefined) =>
        v !== undefined ? (Number.isFinite(v) ? v : undefined) : undefined;
      setShipments((prev) => {
        const rows = Array.isArray(prev) ? prev : [];
        return rows.map((s) => {
          if (s.id !== id) return s;
          updated = {
            ...s,
            ...patch,
            title: patch.title !== undefined ? patch.title.trim() : s.title,
            supplier: patch.supplier !== undefined ? patch.supplier.trim() : s.supplier,
            trackingNumber:
              patch.trackingNumber !== undefined
                ? patch.trackingNumber.trim() || undefined
                : s.trackingNumber,
            notes: patch.notes !== undefined ? patch.notes.trim() || undefined : s.notes,
            expectedAt:
              patch.expectedAt !== undefined ? patch.expectedAt || undefined : s.expectedAt,
            arrivedAt: patch.arrivedAt !== undefined ? patch.arrivedAt || undefined : s.arrivedAt,
            totalCost: patch.totalCost !== undefined ? num(patch.totalCost) : s.totalCost,
            currency: patch.currency ?? s.currency,
            freightMode: patch.freightMode !== undefined ? patch.freightMode : s.freightMode,
            freightCost: patch.freightCost !== undefined ? num(patch.freightCost) : s.freightCost,
            freightCurrency: patch.freightCurrency ?? s.freightCurrency,
            weightKg: patch.weightKg !== undefined ? num(patch.weightKg) : s.weightKg,
            volumeCbm: patch.volumeCbm !== undefined ? num(patch.volumeCbm) : s.volumeCbm,
            cartons: patch.cartons !== undefined ? num(patch.cartons) : s.cartons,
            titusLocation:
              patch.titusLocation !== undefined
                ? patch.titusLocation.trim() || undefined
                : s.titusLocation,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        });
      });
      return updated;
    },
    [setShipments],
  );

  const removeShipment = useCallback(
    (id: string) => {
      setShipments((prev) => (Array.isArray(prev) ? prev : []).filter((s) => s.id !== id));
    },
    [setShipments],
  );

  const addAttachment = useCallback(
    (
      shipmentId: string,
      file: { name: string; dataUrl: string; kind: ShipmentAttachment["kind"] },
    ) => {
      const att: ShipmentAttachment = {
        id: newId("att"),
        name: file.name,
        dataUrl: file.dataUrl,
        kind: file.kind,
        createdAt: new Date().toISOString(),
      };
      let ok = false;
      setShipments((prev) => {
        const rows = Array.isArray(prev) ? prev : [];
        return rows.map((s) => {
          if (s.id !== shipmentId) return s;
          ok = true;
          return {
            ...s,
            attachments: [att, ...(s.attachments ?? [])],
            updatedAt: new Date().toISOString(),
          };
        });
      });
      return ok ? att : null;
    },
    [setShipments],
  );

  const removeAttachment = useCallback(
    (shipmentId: string, attachmentId: string) => {
      setShipments((prev) => {
        const rows = Array.isArray(prev) ? prev : [];
        return rows.map((s) =>
          s.id !== shipmentId
            ? s
            : {
                ...s,
                attachments: (s.attachments ?? []).filter((a) => a.id !== attachmentId),
                updatedAt: new Date().toISOString(),
              },
        );
      });
    },
    [setShipments],
  );

  const value = useMemo(
    () => ({
      shipments: list,
      getShipment,
      addShipment,
      updateShipment,
      removeShipment,
      addAttachment,
      removeAttachment,
    }),
    [
      list,
      getShipment,
      addShipment,
      updateShipment,
      removeShipment,
      addAttachment,
      removeAttachment,
    ],
  );

  return <ShipmentsContext.Provider value={value}>{children}</ShipmentsContext.Provider>;
}

export function useShipments() {
  const ctx = useContext(ShipmentsContext);
  if (!ctx) throw new Error("useShipments must be used within ShipmentsProvider");
  return ctx;
}
