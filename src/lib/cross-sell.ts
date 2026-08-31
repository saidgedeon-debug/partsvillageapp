import type { SavedDocument } from "@/components/app/documents-context";
import type { PartKit } from "@/components/app/kits-context";
import { kitMatchesMachine } from "@/lib/part-identity";

export type CrossSellSuggestion = {
  partId: string;
  partNumber: string;
  name: string;
  reason: string;
  qty: number;
  lastSoldDate?: string;
};

/** Suggest kit lines + historically co-sold parts for a machine / cart. */
export function buildCrossSellSuggestions(input: {
  make?: string;
  model?: string;
  kits: PartKit[];
  /** Recent invoice/order lines for this client or machine. */
  historyLines: Array<{
    partId: string;
    partNumber: string;
    name: string;
    qty: number;
    date: string;
  }>;
  /** Part ids already in the cart / invoice. */
  excludePartIds: Set<string>;
  getPartMeta?: (partId: string) => { partNumber: string; name: string } | undefined;
  limit?: number;
}): CrossSellSuggestion[] {
  const limit = input.limit ?? 8;
  const out: CrossSellSuggestion[] = [];
  const seen = new Set(input.excludePartIds);

  if (input.make || input.model) {
    for (const kit of input.kits) {
      if (!kitMatchesMachine(kit.machine, input.make ?? "", input.model ?? "")) continue;
      for (const line of kit.lines) {
        if (seen.has(line.partId)) continue;
        seen.add(line.partId);
        const meta = input.getPartMeta?.(line.partId);
        out.push({
          partId: line.partId,
          partNumber: meta?.partNumber ?? line.partId,
          name: meta?.name ?? kit.name,
          reason: `Kit · ${kit.name}`,
          qty: line.qty,
        });
        if (out.length >= limit) return out;
      }
    }
  }

  const freq = new Map<
    string,
    { partId: string; partNumber: string; name: string; qty: number; date: string; count: number }
  >();
  for (const line of input.historyLines) {
    if (seen.has(line.partId)) continue;
    const cur = freq.get(line.partId);
    if (!cur) {
      freq.set(line.partId, { ...line, count: 1 });
    } else {
      cur.count += 1;
      cur.qty += line.qty;
      if (line.date > cur.date) cur.date = line.date;
    }
  }

  const ranked = [...freq.values()].sort(
    (a, b) => b.count - a.count || b.date.localeCompare(a.date),
  );
  for (const row of ranked) {
    if (seen.has(row.partId)) continue;
    seen.add(row.partId);
    out.push({
      partId: row.partId,
      partNumber: row.partNumber,
      name: row.name,
      reason: `Often sold · last ${row.date}`,
      qty: 1,
      lastSoldDate: row.date,
    });
    if (out.length >= limit) break;
  }

  return out;
}

export function flattenInvoiceHistory(
  invoices: SavedDocument[],
): Array<{ partId: string; partNumber: string; name: string; qty: number; date: string }> {
  const rows: Array<{
    partId: string;
    partNumber: string;
    name: string;
    qty: number;
    date: string;
  }> = [];
  for (const inv of invoices) {
    if (inv.kind !== "invoice") continue;
    for (const line of inv.lines) {
      rows.push({
        partId: line.partId,
        partNumber: line.partNumber,
        name: line.name,
        qty: line.qty,
        date: inv.date,
      });
    }
  }
  return rows;
}
