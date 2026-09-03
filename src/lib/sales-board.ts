/** Weekly sales insights from invoices + inventory. */

import type { SavedDocument } from "@/components/app/documents-context";
import type { Part } from "@/lib/mock-data";
import { localTodayIso } from "@/lib/date-local";

export type MoverRow = {
  partId: string;
  partNumber: string;
  name: string;
  qtySold: number;
  revenue: number;
  cost: number;
  margin: number;
};

export type DeadStockRow = {
  part: Part;
  daysSinceSale: number | null;
};

function daysBetween(a: string, b: string): number {
  const ms =
    new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function weekAgoIso(today = localTodayIso()): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function buildWeeklySalesBoard(
  parts: Part[],
  invoices: SavedDocument[],
  opts?: { from?: string; to?: string },
): {
  from: string;
  to: string;
  topMovers: MoverRow[];
  marginWinners: MoverRow[];
  deadStock: DeadStockRow[];
  revenue: number;
  margin: number;
} {
  const to = opts?.to ?? localTodayIso();
  const from = opts?.from ?? weekAgoIso(to);
  const byId = new Map(parts.map((p) => [p.id, p]));

  const sold = new Map<string, MoverRow>();
  const lastSale = new Map<string, string>();

  for (const inv of invoices) {
    if (inv.kind !== "invoice") continue;
    if (inv.date < from || inv.date > to) continue;
    for (const line of inv.lines ?? []) {
      const id = line.partId;
      if (!id || id.startsWith("pay-") || id.startsWith("disc-")) continue;
      const qty = Number(line.qty) || 0;
      if (qty <= 0) continue;
      const unitPrice = Number(line.unitPrice) || 0;
      const unitCost = Number(line.unitCost) || 0;
      const prev = sold.get(id) ?? {
        partId: id,
        partNumber: line.partNumber || id,
        name: line.name || "",
        qtySold: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
      };
      prev.qtySold += qty;
      prev.revenue += unitPrice * qty;
      prev.cost += unitCost * qty;
      prev.margin = prev.revenue - prev.cost;
      sold.set(id, prev);
      const prevDate = lastSale.get(id);
      if (!prevDate || inv.date > prevDate) lastSale.set(id, inv.date);
    }
  }

  // Also scan full invoice history for last-sale dates (dead stock).
  for (const inv of invoices) {
    if (inv.kind !== "invoice") continue;
    for (const line of inv.lines ?? []) {
      const id = line.partId;
      if (!id) continue;
      const prevDate = lastSale.get(id);
      if (!prevDate || inv.date > prevDate) lastSale.set(id, inv.date);
    }
  }

  const movers = [...sold.values()].map((r) => ({
    ...r,
    revenue: Math.round(r.revenue * 100) / 100,
    cost: Math.round(r.cost * 100) / 100,
    margin: Math.round(r.margin * 100) / 100,
  }));

  const topMovers = [...movers].sort((a, b) => b.qtySold - a.qtySold).slice(0, 15);
  const marginWinners = [...movers]
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 15);

  const deadStock: DeadStockRow[] = parts
    .filter((p) => p.quantity > 0 && (p.cost > 0 || p.price > 0))
    .map((part) => {
      const last = lastSale.get(part.id);
      return {
        part,
        daysSinceSale: last ? daysBetween(last, to) : null,
      };
    })
    .filter((r) => r.daysSinceSale == null || r.daysSinceSale >= 60)
    .sort((a, b) => {
      const da = a.daysSinceSale ?? 9999;
      const db = b.daysSinceSale ?? 9999;
      return db - da;
    })
    .slice(0, 20);

  // Enrich names from catalog when missing
  for (const row of [...topMovers, ...marginWinners]) {
    const p = byId.get(row.partId);
    if (p) {
      if (!row.name) row.name = p.name;
      if (!row.partNumber) row.partNumber = p.partNumber;
    }
  }

  const revenue = movers.reduce((s, r) => s + r.revenue, 0);
  const margin = movers.reduce((s, r) => s + r.margin, 0);

  return {
    from,
    to,
    topMovers,
    marginWinners,
    deadStock,
    revenue: Math.round(revenue * 100) / 100,
    margin: Math.round(margin * 100) / 100,
  };
}
