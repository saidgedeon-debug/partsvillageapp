import { roundMoney } from "@/lib/document-money";

export type PreOrderLine = {
  partId: string;
  partNumber: string;
  name: string;
  qty: number;
  unitPrice: number;
  /** Buying cost per unit (USD), before freight allocation. */
  unitCost?: number;
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
  /** Freight / shipment cost (USD) to spread across lines by cost weight. */
  shipmentCost?: number;
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

/** Extended (goods) cost for a single line: unit cost × qty. */
export function lineCostWeight(line: PreOrderLine): number {
  return Math.max(0, line.qty) * Math.max(0, line.unitCost ?? 0);
}

/** Sum of extended buying cost across all lines (before freight). */
export function goodsCostTotal(lines: PreOrderLine[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + lineCostWeight(line), 0));
}

export type LineLanding = {
  line: PreOrderLine;
  /** Extended goods cost for this line (unit cost × qty). */
  goodsCost: number;
  /** Freight allocated to this line (USD). */
  freightShare: number;
  /** Landed unit cost = unit cost + freight per unit. */
  landedUnitCost: number;
  /** Landed extended cost = goods cost + freight share. */
  landedTotal: number;
};

/**
 * Spread `shipmentCost` across lines weighted by each line's extended cost
 * (unit cost × qty). Lines with no cost get no freight. Rounding drift is
 * absorbed by the largest-weight line so shares always sum to shipmentCost.
 */
export function allocateFreight(
  lines: PreOrderLine[],
  shipmentCost: number,
): LineLanding[] {
  const freight = Math.max(0, Number(shipmentCost) || 0);
  const totalWeight = lines.reduce((sum, line) => sum + lineCostWeight(line), 0);

  const landings: LineLanding[] = lines.map((line) => {
    const goodsCost = roundMoney(lineCostWeight(line));
    const rawShare =
      totalWeight > 0 && freight > 0
        ? (lineCostWeight(line) / totalWeight) * freight
        : 0;
    const freightShare = roundMoney(rawShare);
    const qty = Math.max(1, line.qty);
    return {
      line,
      goodsCost,
      freightShare,
      landedUnitCost: roundMoney(Math.max(0, line.unitCost ?? 0) + freightShare / qty),
      landedTotal: roundMoney(goodsCost + freightShare),
    };
  });

  // Absorb rounding drift into the heaviest line so shares total exactly.
  if (freight > 0 && totalWeight > 0) {
    const allocated = landings.reduce((sum, l) => sum + l.freightShare, 0);
    const drift = roundMoney(freight - allocated);
    if (Math.abs(drift) >= 0.01) {
      let heaviestIdx = 0;
      for (let i = 1; i < landings.length; i += 1) {
        if (lineCostWeight(landings[i].line) > lineCostWeight(landings[heaviestIdx].line)) {
          heaviestIdx = i;
        }
      }
      const target = landings[heaviestIdx];
      const qty = Math.max(1, target.line.qty);
      target.freightShare = roundMoney(target.freightShare + drift);
      target.landedTotal = roundMoney(target.goodsCost + target.freightShare);
      target.landedUnitCost = roundMoney(
        Math.max(0, target.line.unitCost ?? 0) + target.freightShare / qty,
      );
    }
  }

  return landings;
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
