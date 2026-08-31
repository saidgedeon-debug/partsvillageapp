import type { Part } from "@/lib/mock-data";
import type { SavedDocument } from "@/components/app/documents-context";
import { invoiceAmountPaid } from "@/components/app/documents-context";
import { roundMoney } from "@/lib/document-money";

export type MarginRadar = {
  negativeMarginSales: Array<{
    invoiceId: string;
    partNumber: string;
    name: string;
    qty: number;
    revenue: number;
    cost: number;
    margin: number;
    date: string;
  }>;
  topProfitParts: Array<{
    partId: string;
    partNumber: string;
    name: string;
    revenue: number;
    cost: number;
    profit: number;
  }>;
  deadStock: Array<{
    part: Part;
    daysSinceSale: number | null;
  }>;
  zeroCostPriced: Part[];
};

/** Dashboard “money radar” — negative margin, dead stock, zero-cost sells. */
export function buildMarginRadar(
  parts: Part[],
  invoices: SavedDocument[],
  now = new Date(),
): MarginRadar {
  const lastSold = new Map<string, string>();
  const profitByPart = new Map<
    string,
    { partId: string; partNumber: string; name: string; revenue: number; cost: number }
  >();
  const negative: MarginRadar["negativeMarginSales"] = [];

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  for (const inv of invoices) {
    if (inv.kind !== "invoice") continue;
    for (const line of inv.lines) {
      const prev = lastSold.get(line.partId);
      if (!prev || inv.date > prev) lastSold.set(line.partId, inv.date);

      const revenue = roundMoney(line.qty * (line.unitPrice || 0));
      const cost = roundMoney(line.qty * (line.unitCost || 0));
      const margin = roundMoney(revenue - cost);
      if (revenue > 0.005 && cost > 0.005 && margin < -0.005) {
        negative.push({
          invoiceId: inv.id,
          partNumber: line.partNumber,
          name: line.name,
          qty: line.qty,
          revenue,
          cost,
          margin,
          date: inv.date,
        });
      }

      if (inv.date.startsWith(monthKey) && invoiceAmountPaid(inv) > 0.005) {
        const cur = profitByPart.get(line.partId) ?? {
          partId: line.partId,
          partNumber: line.partNumber,
          name: line.name,
          revenue: 0,
          cost: 0,
        };
        cur.revenue = roundMoney(cur.revenue + revenue);
        cur.cost = roundMoney(cur.cost + cost);
        profitByPart.set(line.partId, cur);
      }
    }
  }

  const topProfitParts = [...profitByPart.values()]
    .map((row) => ({
      ...row,
      profit: roundMoney(row.revenue - row.cost),
    }))
    .filter((row) => row.profit > 0.005)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 8);

  const deadStock = parts
    .filter((p) => p.quantity > 0)
    .map((part) => {
      const sold = lastSold.get(part.id);
      if (!sold) {
        return { part, daysSinceSale: null as number | null };
      }
      const days = Math.floor(
        (now.getTime() - new Date(`${sold}T00:00:00`).getTime()) / 86_400_000,
      );
      return { part, daysSinceSale: days };
    })
    .filter((row) => row.daysSinceSale == null || row.daysSinceSale >= 180)
    .sort((a, b) => (b.daysSinceSale ?? 9999) - (a.daysSinceSale ?? 9999))
    .slice(0, 10);

  const zeroCostPriced = parts
    .filter((p) => p.quantity > 0 && p.price > 0 && !(p.cost > 0))
    .slice(0, 12);

  negative.sort((a, b) => a.margin - b.margin);

  return {
    negativeMarginSales: negative.slice(0, 10),
    topProfitParts,
    deadStock,
    zeroCostPriced,
  };
}
