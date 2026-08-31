import { roundMoney } from "@/lib/document-money";

export type LandedCostLine = {
  id: string;
  qty: number;
  unitCost: number;
};

export type LandedCostAllocation = LandedCostLine & {
  goodsValue: number;
  freightShare: number;
  customsShare: number;
  landedUnitCost: number;
  landedTotal: number;
};

/**
 * Split freight + customs across lines by goods value (qty × unitCost).
 * Falls back to qty share when goods value is zero.
 */
export function allocateLandedCosts(
  lines: LandedCostLine[],
  freightTotal: number,
  customsTotal = 0,
): LandedCostAllocation[] {
  const freight = Math.max(0, freightTotal || 0);
  const customs = Math.max(0, customsTotal || 0);
  const enriched = lines.map((line) => {
    const qty = Math.max(0, line.qty || 0);
    const unitCost = Math.max(0, line.unitCost || 0);
    return {
      ...line,
      qty,
      unitCost,
      goodsValue: roundMoney(qty * unitCost),
    };
  });
  const goodsSum = enriched.reduce((s, l) => s + l.goodsValue, 0);
  const qtySum = enriched.reduce((s, l) => s + l.qty, 0);

  return enriched.map((line) => {
    const weight =
      goodsSum > 0.005
        ? line.goodsValue / goodsSum
        : qtySum > 0
          ? line.qty / qtySum
          : 0;
    const freightShare = roundMoney(freight * weight);
    const customsShare = roundMoney(customs * weight);
    const landedTotal = roundMoney(line.goodsValue + freightShare + customsShare);
    const landedUnitCost =
      line.qty > 0 ? roundMoney(landedTotal / line.qty) : roundMoney(line.unitCost);
    return {
      id: line.id,
      qty: line.qty,
      unitCost: line.unitCost,
      goodsValue: line.goodsValue,
      freightShare,
      customsShare,
      landedUnitCost,
      landedTotal,
    };
  });
}
