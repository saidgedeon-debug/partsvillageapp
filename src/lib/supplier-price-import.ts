/** Cost-only supplier price list import (does not change sell price). */
import * as XLSX from "xlsx";

import { partNumbersOf, type Part } from "@/lib/mock-data";

export type SupplierPriceMapping = {
  partNumber: string;
  cost: string;
};

export type SupplierPriceRow = {
  code: string;
  cost: number;
  partId?: string;
  beforeCost?: number;
  action: "update" | "skip";
  reason?: string;
};

export function readSupplierPriceWorkbook(buf: ArrayBuffer): {
  headers: string[];
  rows: Record<string, unknown>[];
} {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

export function guessSupplierPriceMapping(headers: string[]): SupplierPriceMapping {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (...needles: string[]) => {
    const i = lower.findIndex((h) => needles.some((n) => h.includes(n)));
    return i >= 0 ? headers[i]! : "";
  };
  return {
    partNumber: find("part", "code", "sku", "pn", "item") || headers[0] || "",
    cost: find("cost", "price", "unit", "rmb", "usd", "amount") || headers[1] || "",
  };
}

function cellStr(row: Record<string, unknown>, key: string): string {
  if (!key) return "";
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

function cellNum(row: Record<string, unknown>, key: string): number | null {
  const raw = cellStr(row, key).replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function buildSupplierPricePreview(
  rows: Record<string, unknown>[],
  mapping: SupplierPriceMapping,
  parts: Part[],
): SupplierPriceRow[] {
  const byCode = new Map<string, Part>();
  for (const part of parts) {
    for (const code of partNumbersOf(part)) {
      byCode.set(code.trim().toLowerCase(), part);
    }
  }

  const out: SupplierPriceRow[] = [];
  for (const row of rows) {
    const code = cellStr(row, mapping.partNumber);
    if (!code) continue;
    const cost = cellNum(row, mapping.cost);
    if (cost == null || cost < 0) {
      out.push({ code, cost: 0, action: "skip", reason: "No cost" });
      continue;
    }
    const part = byCode.get(code.toLowerCase());
    if (!part) {
      out.push({ code, cost, action: "skip", reason: "Not in catalog" });
      continue;
    }
    out.push({
      code,
      cost,
      partId: part.id,
      beforeCost: part.cost,
      action: "update",
    });
  }
  return out;
}
