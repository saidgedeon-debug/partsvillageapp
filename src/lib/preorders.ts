import { roundMoney } from "@/lib/document-money";

export type PreOrderLine = {
  partId: string;
  partNumber: string;
  name: string;
  qty: number;
  unitPrice: number;
};

export type CustomerPreOrder = {
  id: string;
  clientId?: string;
  clientName: string;
  orderedAt: string;
  /** Total selling price for the pre-order. */
  total: number;
  /** Deposit / amount collected so far. */
  amountPaid: number;
  lines: PreOrderLine[];
  notes?: string;
  /** True while parts are still pending from abroad. */
  needsProcurement: boolean;
  createdAt: string;
  updatedAt: string;
};

export function preOrderRemaining(order: CustomerPreOrder): number {
  return Math.max(0, roundMoney((Number.isFinite(order.total) ? order.total : 0) - (Number.isFinite(order.amountPaid) ? order.amountPaid : 0)));
}

export function preOrderIsPaid(order: CustomerPreOrder): boolean {
  return preOrderRemaining(order) <= 0.005;
}

export function linesTotal(lines: PreOrderLine[]): number {
  return roundMoney(
    lines.reduce((sum, line) => sum + Math.max(0, line.qty) * Math.max(0, line.unitPrice), 0),
  );
}

export type SupplierOrderItem = {
  partNumber: string;
  name: string;
  qty: number;
};

/** Aggregate open procurement lines anonymously (no customer / price / date). */
export function buildSupplierOrderList(orders: CustomerPreOrder[]): SupplierOrderItem[] {
  const map = new Map<string, SupplierOrderItem>();
  for (const order of orders) {
    if (!order.needsProcurement) continue;
    for (const line of order.lines) {
      const key = `${line.partNumber.trim().toLowerCase()}::${line.name.trim().toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.qty += Math.max(0, Math.round(line.qty) || 0);
      } else {
        map.set(key, {
          partNumber: line.partNumber.trim(),
          name: line.name.trim(),
          qty: Math.max(0, Math.round(line.qty) || 0),
        });
      }
    }
  }
  return [...map.values()]
    .filter((item) => item.qty > 0 && item.partNumber)
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber) || a.name.localeCompare(b.name));
}

export function supplierOrderListText(items: SupplierOrderItem[]): string {
  if (items.length === 0) return "No items pending from abroad.";
  return [
    "Supplier order list",
    "Part Number | Name | Qty",
    ...items.map((item) => `${item.partNumber} | ${item.name} | ${item.qty}`),
  ].join("\n");
}
