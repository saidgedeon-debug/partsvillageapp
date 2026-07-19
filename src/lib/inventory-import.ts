import * as XLSX from "xlsx";

import { oemNumbersOf, type Part } from "@/lib/mock-data";

export type InventoryExcelUpdate = {
  id: string;
  quantity?: number;
  cost?: number;
  price?: number;
  reorderAt?: number;
};

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return row[k];
    }
  }
  // case-insensitive
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  );
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || String(v).trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse an inventory Excel/CSV file into bulk updates keyed by part id. */
export function parseInventoryExcelFile(
  data: ArrayBuffer,
  parts: Part[],
): { updates: InventoryExcelUpdate[]; matched: number; skipped: number } {
  const book = XLSX.read(data, { type: "array" });
  const sheetName = book.SheetNames[0];
  if (!sheetName) return { updates: [], matched: 0, skipped: 0 };
  const sheet = book.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const index = new Map<string, string>();
  for (const p of parts) {
    index.set(p.partNumber.trim().toLowerCase(), p.id);
    for (const oem of oemNumbersOf(p)) {
      index.set(oem.trim().toLowerCase(), p.id);
    }
  }

  const byId = new Map<string, InventoryExcelUpdate>();
  let skipped = 0;

  for (const row of rows) {
    const codeRaw = pick(row, [
      "Part Code",
      "PartCode",
      "Part #",
      "Part#",
      "partNumber",
      "OEM / Serial",
      "OEM",
    ]);
    const code = String(codeRaw ?? "")
      .split(/[/|,]/)[0]
      ?.trim()
      .toLowerCase();
    if (!code) {
      skipped += 1;
      continue;
    }
    const id = index.get(code);
    if (!id) {
      // try full OEM cell match
      const oemCell = String(pick(row, ["OEM / Serial", "OEM"]) ?? "")
        .toLowerCase()
        .trim();
      let found: string | undefined;
      if (oemCell) {
        for (const piece of oemCell.split(/\s*\/\s*|\s*,\s*/)) {
          found = index.get(piece.trim());
          if (found) break;
        }
      }
      if (!found) {
        skipped += 1;
        continue;
      }
      byId.set(found, {
        id: found,
        quantity: toNum(pick(row, ["Qty", "Quantity", "quantity"])),
        cost: toNum(pick(row, ["Cost", "cost"])),
        price: toNum(pick(row, ["Price", "price"])),
        reorderAt: toNum(pick(row, ["Reorder at", "Reorder", "reorderAt"])),
      });
      continue;
    }

    const patch: InventoryExcelUpdate = {
      id,
      quantity: toNum(pick(row, ["Qty", "Quantity", "quantity"])),
      cost: toNum(pick(row, ["Cost", "cost"])),
      price: toNum(pick(row, ["Price", "price"])),
      reorderAt: toNum(pick(row, ["Reorder at", "Reorder", "reorderAt"])),
    };
    if (
      patch.quantity === undefined &&
      patch.cost === undefined &&
      patch.price === undefined &&
      patch.reorderAt === undefined
    ) {
      skipped += 1;
      continue;
    }
    byId.set(id, patch);
  }

  return {
    updates: [...byId.values()],
    matched: byId.size,
    skipped,
  };
}
