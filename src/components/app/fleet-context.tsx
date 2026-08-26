import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import { useCloudState } from "@/lib/cloud-store";
import { onInvoiceBalanceChange } from "@/lib/invoice-order-sync";
import { newLocalId } from "@/lib/storage";

export type FleetMachine = {
  id: string;
  clientId: string;
  make: string;
  model: string;
  serialNumber: string;
  year: number;
  hours: number;
};

export type FleetOrderLine = {
  partId: string;
  partNumber: string;
  name: string;
  qty: number;
  unitPrice: number;
};

export type FleetOrder = {
  id: string;
  clientId: string;
  machineId: string;
  date: string;
  status: "Paid" | "Pending" | "Quoted";
  documentId?: string;
  lines: FleetOrderLine[];
};

type StoredFleet = {
  machines: FleetMachine[];
  orders: FleetOrder[];
};

type FleetContextValue = {
  machines: FleetMachine[];
  orders: FleetOrder[];
  machinesByClient: (clientId: string) => FleetMachine[];
  ordersByClient: (clientId: string) => FleetOrder[];
  ordersByMachine: (machineId: string) => FleetOrder[];
  addMachine: (input: Omit<FleetMachine, "id"> & { id?: string }) => FleetMachine;
  updateMachine: (id: string, patch: Partial<FleetMachine>) => void;
  removeMachine: (id: string) => void;
  addOrder: (input: Omit<FleetOrder, "id"> & { id?: string }) => FleetOrder;
  updateOrder: (id: string, patch: Partial<FleetOrder>) => void;
  removeOrder: (id: string) => void;
};

const STORAGE_KEY = "parts-village-fleet-v1";

const FleetContext = createContext<FleetContextValue | null>(null);

function empty(): StoredFleet {
  return { machines: [], orders: [] };
}

function isFleetEmpty(v: StoredFleet): boolean {
  return (v.machines?.length ?? 0) === 0 && (v.orders?.length ?? 0) === 0;
}

async function syncMachine(_m: FleetMachine) {
  // shop_state JSON is authoritative; relational machines table is unused by the app.
}

async function syncOrder(_o: FleetOrder) {
  // shop_state JSON is authoritative; relational orders table is unused by the app.
}

export function FleetProvider({ children }: { children: ReactNode }) {
  const { value: store, setValue: setStore } = useCloudState<StoredFleet>(
    "fleet",
    STORAGE_KEY,
    empty(),
    isFleetEmpty,
  );

  const machines = store.machines ?? [];
  const orders = store.orders ?? [];

  const machinesByClient = useCallback(
    (clientId: string) => machines.filter((m) => m.clientId === clientId),
    [machines],
  );

  const ordersByClient = useCallback(
    (clientId: string) =>
      [...orders]
        .filter((o) => o.clientId === clientId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [orders],
  );

  const ordersByMachine = useCallback(
    (machineId: string) =>
      [...orders]
        .filter((o) => o.machineId === machineId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [orders],
  );

  const addMachine = useCallback(
    (input: Omit<FleetMachine, "id"> & { id?: string }) => {
      const machine: FleetMachine = {
        id: input.id ?? newLocalId("m"),
        clientId: input.clientId,
        make: input.make.trim(),
        model: input.model.trim(),
        serialNumber: input.serialNumber.trim(),
        year: input.year || new Date().getFullYear(),
        hours: input.hours || 0,
      };
      setStore((prev) => ({
        machines: [...(prev.machines ?? []), machine],
        orders: prev.orders ?? [],
      }));
      void syncMachine(machine);
      return machine;
    },
    [setStore],
  );

  const updateMachine = useCallback(
    (id: string, patch: Partial<FleetMachine>) => {
      setStore((prev) => {
        const machines = (prev.machines ?? []).map((m) => {
          if (m.id !== id) return m;
          const next = { ...m, ...patch, id: m.id };
          void syncMachine(next);
          return next;
        });
        return { machines, orders: prev.orders ?? [] };
      });
    },
    [setStore],
  );

  const removeMachine = useCallback(
    (id: string) => {
      setStore((prev) => ({
        machines: (prev.machines ?? []).filter((m) => m.id !== id),
        orders: (prev.orders ?? []).map((o) => (o.machineId === id ? { ...o, machineId: "" } : o)),
      }));
    },
    [setStore],
  );

  const addOrder = useCallback(
    (input: Omit<FleetOrder, "id"> & { id?: string }) => {
      const order: FleetOrder = {
        id: input.id ?? newLocalId("ord"),
        clientId: input.clientId,
        machineId: input.machineId || "",
        date: input.date,
        status: input.status,
        documentId: input.documentId,
        lines: input.lines,
      };
      setStore((prev) => ({
        machines: prev.machines ?? [],
        orders: [order, ...(prev.orders ?? [])],
      }));
      void syncOrder(order);
      return order;
    },
    [setStore],
  );

  const updateOrder = useCallback(
    (id: string, patch: Partial<FleetOrder>) => {
      setStore((prev) => ({
        machines: prev.machines ?? [],
        orders: (prev.orders ?? []).map((order) => {
          if (order.id !== id) return order;
          const next = { ...order, ...patch, id: order.id };
          void syncOrder(next);
          return next;
        }),
      }));
    },
    [setStore],
  );

  const removeOrder = useCallback(
    (id: string) => {
      setStore((prev) => ({
        machines: prev.machines ?? [],
        orders: (prev.orders ?? []).filter((order) => order.id !== id),
      }));
    },
    [setStore],
  );

  useEffect(() => {
    return onInvoiceBalanceChange((documentId, remaining) => {
      const nextStatus: FleetOrder["status"] = remaining <= 0.005 ? "Paid" : "Pending";
      setStore((prev) => {
        const orders = prev.orders ?? [];
        let changed = false;
        const nextOrders = orders.map((order) => {
          const linked =
            order.documentId === documentId || order.id === `ord-${documentId}`;
          if (!linked || order.status === nextStatus) return order;
          changed = true;
          const next = { ...order, status: nextStatus };
          void syncOrder(next);
          return next;
        });
        if (!changed) return prev;
        return { machines: prev.machines ?? [], orders: nextOrders };
      });
    });
  }, [setStore]);

  const value = useMemo(
    () => ({
      machines,
      orders,
      machinesByClient,
      ordersByClient,
      ordersByMachine,
      addMachine,
      updateMachine,
      removeMachine,
      addOrder,
      updateOrder,
      removeOrder,
    }),
    [
      machines,
      orders,
      machinesByClient,
      ordersByClient,
      ordersByMachine,
      addMachine,
      updateMachine,
      removeMachine,
      addOrder,
      updateOrder,
      removeOrder,
    ],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used within FleetProvider");
  return ctx;
}
