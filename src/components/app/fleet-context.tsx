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
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

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
  addMachine: (
    input: Omit<FleetMachine, "id"> & { id?: string },
  ) => FleetMachine;
  updateMachine: (id: string, patch: Partial<FleetMachine>) => void;
  removeMachine: (id: string) => void;
  addOrder: (input: Omit<FleetOrder, "id"> & { id?: string }) => FleetOrder;
};

const STORAGE_KEY = "parts-village-fleet-v1";

const FleetContext = createContext<FleetContextValue | null>(null);

function empty(): StoredFleet {
  return { machines: [], orders: [] };
}

async function syncMachine(m: FleetMachine) {
  if (!supabase || !isSupabaseConfigured) return;
  try {
    await supabase.from("machines").upsert({
      id: m.id,
      client_id: m.clientId,
      make: m.make,
      model: m.model,
      serial_number: m.serialNumber,
      year: m.year,
      hours: m.hours,
    } as never);
  } catch {
    // ignore
  }
}

async function syncOrder(o: FleetOrder) {
  if (!supabase || !isSupabaseConfigured) return;
  try {
    await supabase.from("orders").upsert({
      id: o.id,
      client_id: o.clientId,
      machine_id: o.machineId || o.clientId,
      date: o.date,
      status: o.status,
    } as never);
    for (const line of o.lines) {
      await supabase.from("order_lines").upsert({
        id: `${o.id}-${line.partId}`,
        order_id: o.id,
        part_id: line.partId,
        qty: line.qty,
        unit_price: line.unitPrice,
      } as never);
    }
  } catch {
    // ignore
  }
}

export function FleetProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoredFleet>(() =>
    loadJson<StoredFleet>(STORAGE_KEY, empty()),
  );

  useEffect(() => {
    saveJson(STORAGE_KEY, store);
  }, [store]);

  const machinesByClient = useCallback(
    (clientId: string) => store.machines.filter((m) => m.clientId === clientId),
    [store.machines],
  );

  const ordersByClient = useCallback(
    (clientId: string) =>
      [...store.orders]
        .filter((o) => o.clientId === clientId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [store.orders],
  );

  const ordersByMachine = useCallback(
    (machineId: string) =>
      [...store.orders]
        .filter((o) => o.machineId === machineId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [store.orders],
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
        ...prev,
        machines: [...prev.machines, machine],
      }));
      void syncMachine(machine);
      return machine;
    },
    [],
  );

  const updateMachine = useCallback((id: string, patch: Partial<FleetMachine>) => {
    setStore((prev) => {
      const machines = prev.machines.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch, id: m.id };
        void syncMachine(next);
        return next;
      });
      return { ...prev, machines };
    });
  }, []);

  const removeMachine = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      machines: prev.machines.filter((m) => m.id !== id),
      orders: prev.orders.map((o) =>
        o.machineId === id ? { ...o, machineId: "" } : o,
      ),
    }));
  }, []);

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
        ...prev,
        orders: [order, ...prev.orders],
      }));
      void syncOrder(order);
      return order;
    },
    [],
  );

  const value = useMemo(
    () => ({
      machines: store.machines,
      orders: store.orders,
      machinesByClient,
      ordersByClient,
      ordersByMachine,
      addMachine,
      updateMachine,
      removeMachine,
      addOrder,
    }),
    [
      store.machines,
      store.orders,
      machinesByClient,
      ordersByClient,
      ordersByMachine,
      addMachine,
      updateMachine,
      removeMachine,
      addOrder,
    ],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used within FleetProvider");
  return ctx;
}
