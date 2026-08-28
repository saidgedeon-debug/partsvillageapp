import type { CartLine } from "@/components/app/cart-context";
import type { Part } from "@/lib/mock-data";

export type StockShortage = {
  partNumber: string;
  need: number;
  have: number;
};

const SKIP_CATEGORIES = new Set(["Payment", "Discount"]);

export function lineQtyByPart(lines: CartLine[]): Map<string, number> {
  const qty = new Map<string, number>();
  for (const line of lines) {
    if (!line.partId || SKIP_CATEGORIES.has(line.category)) continue;
    const n = Number.isFinite(line.qty) ? line.qty : 0;
    qty.set(line.partId, (qty.get(line.partId) ?? 0) + n);
  }
  return qty;
}

export function stockShortagesForQty(
  neededByPart: Map<string, number>,
  getPart: (id: string) => Part | undefined,
  skipPartIds?: Set<string>,
): StockShortage[] {
  const shortages: StockShortage[] = [];
  for (const [partId, need] of neededByPart) {
    if (need <= 0) continue;
    if (skipPartIds?.has(partId)) continue;
    const part = getPart(partId);
    if (!part) continue;
    if (need > part.quantity) {
      shortages.push({
        partNumber: part.partNumber,
        need,
        have: part.quantity,
      });
    }
  }
  return shortages;
}

export async function confirmOversell(shortages: StockShortage[]): Promise<boolean> {
  if (shortages.length === 0) return true;
  const detail = shortages
    .map((row) => `${row.partNumber}: need ${row.need}, on hand ${row.have}`)
    .join("\n");
  const { confirmAction } = await import("@/components/app/confirm-dialog");
  return confirmAction({
    title: "Not enough stock",
    description: `${detail}\n\nSell anyway? Quantity will not go below 0.`,
    confirmLabel: "Sell anyway",
    destructive: true,
  });
}

/** Units sold above on-hand (clamped sales create phantom restock risk later). */
export function computeOversoldByPart(
  neededByPart: Map<string, number>,
  getPart: (id: string) => Part | undefined,
  skipPartIds?: Set<string>,
): Record<string, number> {
  const oversold: Record<string, number> = {};
  for (const [partId, need] of neededByPart) {
    if (need <= 0) continue;
    if (skipPartIds?.has(partId)) continue;
    const part = getPart(partId);
    if (!part) continue;
    const have = Math.max(0, part.quantity);
    if (need > have) oversold[partId] = need - have;
  }
  return oversold;
}

/**
 * How many units can physically return to the shelf for this part on an invoice
 * that may have been oversold (clamped at 0).
 */
export function physicalRestockCap(
  soldQty: number,
  oversoldQty: number,
  alreadyRestocked: number,
): number {
  const physicalSold = Math.max(0, soldQty - Math.max(0, oversoldQty));
  return Math.max(0, physicalSold - Math.max(0, alreadyRestocked));
}

/** Stock delta to apply on invoice edit: negative deducts, positive restocks. */
export function invoiceEditStockDeltas(
  oldLines: CartLine[],
  newLines: CartLine[],
  stockDeductedOriginally: boolean,
  sessionDeducted: Map<string, number>,
): Map<string, number> {
  const oldQty = lineQtyByPart(oldLines);
  const newQty = lineQtyByPart(newLines);
  const ids = new Set([...oldQty.keys(), ...newQty.keys(), ...sessionDeducted.keys()]);
  const deltas = new Map<string, number>();

  for (const id of ids) {
    const previous = oldQty.get(id) ?? 0;
    const next = newQty.get(id) ?? 0;
    const already = sessionDeducted.get(id) ?? 0;
    let stockChange = 0;

    if (already > 0) {
      if (stockDeductedOriginally && previous > 0) {
        stockChange = -(next - previous - already);
      } else {
        stockChange = -(next - already);
      }
    } else if (stockDeductedOriginally) {
      stockChange = -(next - previous);
    }

    if (stockChange !== 0) deltas.set(id, stockChange);
  }

  return deltas;
}
