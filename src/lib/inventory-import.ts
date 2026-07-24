import * as XLSX from "xlsx";

import { oemNumbersOf, type Part } from "@/lib/mock-data";

export type InventoryExcelUpdate = {
  id: string;
  quantity?: number;
  cost?: number;
  price?: number;
  reorderAt?: number;
};

export type InventoryImportMapping = {
  partNumber: string;
  name: string;
  category: string;
  quantity: string;
  cost: string;
  price: string;
  reorderAt: string;
};

export type InventoryImportPreviewRow =
  | { action: "update"; code: string; name: string; update: InventoryExcelUpdate }
  | {
      action: "create";
      code: string;
      name: string;
      part: Pick<
        Part,
        | "partNumber"
        | "name"
        | "category"
        | "quantity"
        | "cost"
        | "price"
        | "reorderAt"
        | "compatibility"
      >;
    }
  | { action: "skip"; code: string; name: string; reason: string };

export function readInventoryWorkbook(data: ArrayBuffer): {
  headers: string[];
  rows: Record<string, unknown>[];
} {
  const book = XLSX.read(data, { type: "array" });
  const sheetName = book.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = book.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return { headers: rows[0] ? Object.keys(rows[0]) : [], rows };
}

export function guessInventoryMapping(headers: string[]): InventoryImportMapping {
  const find = (...names: string[]) =>
    headers.find((header) => names.includes(header.trim().toLowerCase())) ?? "";
  return {
    partNumber: find("part code", "partcode", "part #", "part#", "partnumber", "oem"),
    name: find("name", "description", "part name"),
    category: find("category", "group"),
    quantity: find("qty", "quantity"),
    cost: find("cost", "unit cost"),
    price: find("price", "unit price"),
    reorderAt: find("reorder at", "reorder", "reorderat"),
  };
}

export function buildInventoryImportPreview(
  rows: Record<string, unknown>[],
  mapping: InventoryImportMapping,
  parts: Part[],
): InventoryImportPreviewRow[] {
  const index = new Map<string, Part>();
  for (const part of parts) {
    index.set(part.partNumber.trim().toLowerCase(), part);
    for (const number of oemNumbersOf(part)) index.set(number.trim().toLowerCase(), part);
  }
  return rows.map((row) => {
    const code = String(row[mapping.partNumber] ?? "").trim();
    const name = String(row[mapping.name] ?? "").trim() || code;
    if (!code) return { action: "skip", code: "", name, reason: "Missing part number" };
    const quantity = toNum(row[mapping.quantity]);
    const cost = toNum(row[mapping.cost]);
    const price = toNum(row[mapping.price]);
    const reorderAt = toNum(row[mapping.reorderAt]);
    const existing = index.get(code.toLowerCase());
    if (existing) {
      return {
        action: "update",
        code,
        name: existing.name,
        update: { id: existing.id, quantity, cost, price, reorderAt },
      };
    }
    return {
      action: "create",
      code,
      name,
      part: {
        partNumber: code,
        name,
        category: String(row[mapping.category] ?? "").trim() || "Imported",
        quantity: Math.max(0, Math.round(quantity ?? 0)),
        cost: Math.max(0, cost ?? 0),
        price: Math.max(0, price ?? 0),
        reorderAt: Math.max(0, Math.round(reorderAt ?? 0)),
        compatibility: [],
      },
    };
  });
}

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
