import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { useCloudState } from "@/lib/cloud-store";
import { roundMoney } from "@/lib/document-money";
import {
  linesTotal,
  type CustomerPreOrder,
  type PreOrderLine,
} from "@/lib/preorders";
import { newLocalId } from "@/lib/storage";

export type PreOrderInput = {
  clientId?: string;
  clientName: string;
  orderedAt: string;
  lines: PreOrderLine[];
  amountPaid?: number;
  shipmentCost?: number;
  notes?: string;
  needsProcurement?: boolean;
};

type PreOrdersContextValue = {
  orders: CustomerPreOrder[];
  addOrder: (input: PreOrderInput) => CustomerPreOrder;
  updateOrder: (id: string, patch: Partial<PreOrderInput>) => CustomerPreOrder | null;
  recordDeposit: (id: string, amount: number) => CustomerPreOrder | null;
  removeOrder: (id: string) => void;
};

const STORAGE_KEY = "parts-village-pre-orders-v1";

const PreOrdersContext = createContext<PreOrdersContextValue | null>(null);

function isEmpty(v: CustomerPreOrder[]): boolean {
  return (v?.length ?? 0) === 0;
}

function normalizeLines(lines: PreOrderLine[]): PreOrderLine[] {
  return lines
    .filter((line) => line.partNumber.trim() && line.qty > 0)
    .map((line) => ({
      partId: line.partId || line.partNumber,
      partNumber: line.partNumber.trim(),
      name: line.name.trim() || line.partNumber.trim(),
      qty: Math.max(1, Math.round(line.qty) || 1),
      unitPrice: Math.max(0, Number(line.unitPrice) || 0),
      unitCost: Math.max(0, Number(line.unitCost) || 0),
    }));
}

function normalizeShipmentCost(value: unknown): number | undefined {
  const n = roundMoney(Number(value) || 0);
  return n > 0 ? n : undefined;
}

export function PreOrdersProvider({ children }: { children: ReactNode }) {
  const { value: orders, setValue: setOrders } = useCloudState<CustomerPreOrder[]>(
    "pre-orders",
    STORAGE_KEY,
    [],
    isEmpty,
  );

  const list = Array.isArray(orders) ? orders : [];

  const addOrder = useCallback(
    (input: PreOrderInput) => {
      const now = new Date().toISOString();
      const lines = normalizeLines(input.lines);
      const total = linesTotal(lines);
      const amountPaid = Math.min(
        total,
        Math.max(0, roundMoney(Number(input.amountPaid) || 0)),
      );
      const order: CustomerPreOrder = {
        id: newLocalId("po"),
        clientId: input.clientId,
        clientName: input.clientName.trim(),
        orderedAt: input.orderedAt,
        total,
        amountPaid,
        lines,
        shipmentCost: normalizeShipmentCost(input.shipmentCost),
        notes: input.notes?.trim() || undefined,
        needsProcurement: input.needsProcurement !== false,
        createdAt: now,
        updatedAt: now,
      };
      setOrders((prev) => [order, ...(Array.isArray(prev) ? prev : [])]);
      return order;
    },
    [setOrders],
  );

  const updateOrder = useCallback(
    (id: string, patch: Partial<PreOrderInput>) => {
      let updated: CustomerPreOrder | null = null;
      setOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((order) => {
          if (order.id !== id) return order;
          const lines = patch.lines ? normalizeLines(patch.lines) : order.lines;
          const total = linesTotal(lines);
          const amountPaid =
            patch.amountPaid !== undefined
              ? Math.min(total, Math.max(0, roundMoney(Number(patch.amountPaid) || 0)))
              : Math.min(total, order.amountPaid);
          updated = {
            ...order,
            clientId: patch.clientId !== undefined ? patch.clientId : order.clientId,
            clientName:
              patch.clientName !== undefined ? patch.clientName.trim() : order.clientName,
            orderedAt: patch.orderedAt ?? order.orderedAt,
            lines,
            total,
            amountPaid,
            shipmentCost:
              patch.shipmentCost !== undefined
                ? normalizeShipmentCost(patch.shipmentCost)
                : order.shipmentCost,
            notes:
              patch.notes !== undefined
                ? patch.notes.trim() || undefined
                : order.notes,
            needsProcurement:
              patch.needsProcurement !== undefined
                ? patch.needsProcurement
                : order.needsProcurement,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        }),
      );
      return updated;
    },
    [setOrders],
  );

  const recordDeposit = useCallback(
    (id: string, amount: number) => {
      let updated: CustomerPreOrder | null = null;
      const add = roundMoney(amount);
      if (!(add > 0)) return null;
      setOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((order) => {
          if (order.id !== id) return order;
          const amountPaid = Math.min(order.total, roundMoney(order.amountPaid + add));
          updated = {
            ...order,
            amountPaid,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        }),
      );
      return updated;
    },
    [setOrders],
  );

  const removeOrder = useCallback(
    (id: string) => {
      setOrders((prev) => (Array.isArray(prev) ? prev : []).filter((order) => order.id !== id));
    },
    [setOrders],
  );

  const value = useMemo(
    () => ({
      orders: list,
      addOrder,
      updateOrder,
      recordDeposit,
      removeOrder,
    }),
    [list, addOrder, updateOrder, recordDeposit, removeOrder],
  );

  return <PreOrdersContext.Provider value={value}>{children}</PreOrdersContext.Provider>;
}

export function usePreOrders() {
  const ctx = useContext(PreOrdersContext);
  if (!ctx) throw new Error("usePreOrders must be used within PreOrdersProvider");
  return ctx;
}
