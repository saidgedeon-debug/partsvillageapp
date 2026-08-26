import * as XLSX from "xlsx";

import { roundMoney } from "@/lib/document-money";
import { partNumbersOf, type Part } from "@/lib/mock-data";

export const DEFAULT_QUOTATION_CLIENT = "divers";

export type QuotationImportLine = {
  /** Arabic / English description (النوع). */
  name: string;
  /** Part code / model / notes column. */
  partNumber: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type QuotationImportPreview = {
  clientName: string;
  clientNameFromSheet: boolean;
  lines: QuotationImportLine[];
  subtotal: number;
  sheetName: string;
  fileName?: string;
};

const HEADER_MARKERS = [
  "النوع",
  "رقم القطعة",
  "العدد",
  "سعر الوحدة",
  "type",
  "part",
  "qty",
  "quantity",
  "unit price",
  "price",
];

const CLIENT_LABELS = [
  "client",
  "customer",
  "party",
  "للزبون",
  "الزبون",
  "اسم الزبون",
  "العميل",
  "إلى",
  "الى",
  "للسيد",
  "السيد",
  "شركة",
];

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\u00a0/g, " ").trim();
}

function cellNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function looksLikeHeader(row: unknown[]): boolean {
  const joined = row.map(cellStr).join(" ").toLowerCase();
  let hits = 0;
  for (const m of HEADER_MARKERS) {
    if (joined.includes(m.toLowerCase())) hits += 1;
  }
  return hits >= 2;
}

function isTotalRow(row: unknown[]): boolean {
  const joined = row.map(cellStr).join(" ").toLowerCase();
  return (
    joined.includes("الإجمالي") ||
    joined.includes("الاجمالي") ||
    joined.includes("المجموع الكلي") ||
    /\btotal\b/.test(joined)
  );
}

/** Guess client name from early rows (label: value or lone name cell). */
function detectClientName(rows: unknown[][]): { name: string; fromSheet: boolean } {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i] ?? [];
    for (let c = 0; c < row.length; c++) {
      const a = cellStr(row[c]);
      const b = cellStr(row[c + 1]);
      const lower = a.toLowerCase().replace(/[:：]/g, "").trim();
      if (CLIENT_LABELS.some((l) => lower === l || lower.startsWith(`${l} `))) {
        const value = b || a.replace(/^[^:：]+[:：]\s*/, "").trim();
        const cleaned = value
          .replace(/^(client|customer|الزبون|العميل|للسيد|السيد)\s*[:：]?\s*/i, "")
          .trim();
        if (cleaned && cleaned.length >= 2 && !looksLikeHeader([cleaned])) {
          return { name: cleaned, fromSheet: true };
        }
      }
      if (/[:：]/.test(a)) {
        const [label, ...rest] = a.split(/[:：]/);
        const value = rest.join(":").trim() || b;
        if (
          CLIENT_LABELS.some((l) => label.trim().toLowerCase().includes(l)) &&
          value.length >= 2
        ) {
          return { name: value, fromSheet: true };
        }
      }
    }
  }
  return { name: DEFAULT_QUOTATION_CLIENT, fromSheet: false };
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (looksLikeHeader(rows[i] ?? [])) return i;
  }
  // Fallback: first row with 4+ non-empty cells that isn't a title-only row
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const filled = (rows[i] ?? []).map(cellStr).filter(Boolean);
    if (filled.length >= 4) return i;
  }
  return -1;
}

/**
 * Parse a quotation / price-list workbook (Arabic spare-parts list format supported).
 * Columns after header: type/name | part# | qty | unit price | line total (optional).
 */
export function parseQuotationWorkbook(
  data: ArrayBuffer,
  fileName?: string,
): QuotationImportPreview {
  const book = XLSX.read(data, { type: "array" });
  const sheetName = book.SheetNames[0];
  if (!sheetName) {
    return {
      clientName: DEFAULT_QUOTATION_CLIENT,
      clientNameFromSheet: false,
      lines: [],
      subtotal: 0,
      sheetName: "",
      fileName,
    };
  }
  const sheet = book.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const client = detectClientName(rows);
  const headerIdx = findHeaderRow(rows);
  const lines: QuotationImportLine[] = [];

  const start = headerIdx >= 0 ? headerIdx + 1 : 0;
  for (let i = start; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (isTotalRow(row)) break;

    const name = cellStr(row[0]);
    const partRaw = cellStr(row[1]);
    const qty = cellNum(row[2]);
    const unitPrice = cellNum(row[3]);
    const lineTotalRaw = cellNum(row[4]);

    if (!name && !partRaw) continue;
    // Skip leftover header echoes
    if (name === "النوع" || name.toLowerCase() === "type") continue;
    if (!(qty != null && qty > 0) || !(unitPrice != null && unitPrice >= 0)) continue;

    const partNumber = (partRaw || name).replace(/\s+/g, " ").trim();
    const lineTotal =
      lineTotalRaw != null && lineTotalRaw > 0
        ? roundMoney(lineTotalRaw)
        : roundMoney(qty * unitPrice);

    lines.push({
      name: name || partNumber,
      partNumber,
      qty: Math.max(1, Math.round(qty)),
      unitPrice: roundMoney(unitPrice),
      lineTotal,
    });
  }

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
  return {
    clientName: client.name,
    clientNameFromSheet: client.fromSheet,
    lines,
    subtotal,
    sheetName,
    fileName,
  };
}

export type QuotationLineResolution =
  | { status: "match"; line: QuotationImportLine; part: Part }
  | { status: "create"; line: QuotationImportLine };

/** Match existing inventory by part number / OEM; otherwise mark for create. */
export function resolveQuotationLines(
  preview: QuotationImportPreview,
  parts: Part[],
): QuotationLineResolution[] {
  const index = new Map<string, Part>();
  for (const part of parts) {
    for (const n of partNumbersOf(part)) {
      index.set(n.trim().toLowerCase(), part);
    }
  }
  return preview.lines.map((line) => {
    const hit = index.get(line.partNumber.trim().toLowerCase());
    if (hit) return { status: "match" as const, line, part: hit };
    return { status: "create" as const, line };
  });
}
