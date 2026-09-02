import type { Part } from "@/lib/mock-data";
import type { SavedDocument } from "@/components/app/documents-context";
import { roundMoney } from "@/lib/document-money";

export type PartDemand = {
  partId: string;
  unitsSold90d: number;
  unitsSold30d: number;
  avgPerMonth: number;
  daysOfCover: number | null;
  suggestedReorderQty: number;
};

function daysAgoIso(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Rolling sales velocity from invoices (last 90 days). */
export function buildPartDemandMap(
  invoices: SavedDocument[],
  now = new Date(),
): Map<string, { sold90: number; sold30: number }> {
  const since90 = daysAgoIso(90, now);
  const since30 = daysAgoIso(30, now);
  const map = new Map<string, { sold90: number; sold30: number }>();
  for (const inv of invoices) {
    if (inv.kind !== "invoice") continue;
    if (inv.date < since90) continue;
    for (const line of inv.lines) {
      const cur = map.get(line.partId) ?? { sold90: 0, sold30: 0 };
      cur.sold90 += line.qty;
      if (inv.date >= since30) cur.sold30 += line.qty;
      map.set(line.partId, cur);
    }
  }
  return map;
}

export function partDemandFor(
  part: Part,
  demandMap: Map<string, { sold90: number; sold30: number }>,
): PartDemand {
  const row = demandMap.get(part.id) ?? { sold90: 0, sold30: 0 };
  const avgPerMonth = roundMoney((row.sold90 / 90) * 30);
  const daily = row.sold90 / 90;
  const daysOfCover =
    daily > 0.001 && part.quantity > 0 ? Math.floor(part.quantity / daily) : null;
  const targetCoverDays = 45;
  const need = daily > 0 ? Math.ceil(daily * targetCoverDays) - part.quantity : 0;
  const belowReorder = part.quantity <= part.reorderAt;
  const suggestedReorderQty = Math.max(
    0,
    belowReorder || need > 0 ? Math.max(need, part.reorderAt - part.quantity, 1) : 0,
  );
  return {
    partId: part.id,
    unitsSold90d: row.sold90,
    unitsSold30d: row.sold30,
    avgPerMonth,
    daysOfCover,
    suggestedReorderQty:
      suggestedReorderQty > 0 && (belowReorder || avgPerMonth > 0)
        ? suggestedReorderQty
        : belowReorder
          ? Math.max(1, part.reorderAt - part.quantity)
          : 0,
  };
}

export type ReorderSuggestion = {
  part: Part;
  demand: PartDemand;
  reason: string;
};

/** Low-stock + velocity-based reorder candidates for pre-order drafting. */
export function buildReorderSuggestions(
  parts: Part[],
  invoices: SavedDocument[],
  limit = 24,
  now = new Date(),
): ReorderSuggestion[] {
  const demandMap = buildPartDemandMap(invoices, now);
  const out: ReorderSuggestion[] = [];
  for (const part of parts) {
    const demand = partDemandFor(part, demandMap);
    const below = part.quantity <= part.reorderAt;
    const shortCover = demand.daysOfCover != null && demand.daysOfCover < 21 && demand.avgPerMonth > 0;
    if (!below && !shortCover && demand.suggestedReorderQty <= 0) continue;
    const reason = below
      ? `On hand ${part.quantity} ≤ reorder ${part.reorderAt}`
      : shortCover
        ? `~${demand.daysOfCover}d cover · ~${demand.avgPerMonth}/mo`
        : `Velocity suggests +${demand.suggestedReorderQty}`;
    out.push({ part, demand, reason });
  }
  return out
    .sort(
      (a, b) =>
        b.demand.suggestedReorderQty - a.demand.suggestedReorderQty ||
        a.part.quantity - b.part.quantity,
    )
    .slice(0, limit);
}
