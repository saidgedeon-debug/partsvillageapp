import * as XLSX from "xlsx";

import {
  oemNumbersOf,
  partDescriptionOf,
  type Part,
} from "@/lib/mock-data";

/** Download full inventory as Excel (.xlsx). */
export function downloadInventoryExcel(parts: Part[], filename?: string) {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10);
  const name = filename ?? `Parts-Village-Inventory-${stamp}.xlsx`;

  const sorted = [...parts].sort((a, b) =>
    a.partNumber.localeCompare(b.partNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  const rows = sorted.map((p) => ({
    "Part Code": p.partNumber,
    Description: partDescriptionOf(p),
    "OEM / Serial": oemNumbersOf(p).join(" / "),
    Machine: p.compatibility.join(", "),
    Page: p.catalogPage ?? "",
    Category: p.category,
    Qty: p.quantity,
    "Reorder at": p.reorderAt,
    Cost: p.cost > 0 ? p.cost : "",
    Price: p.price > 0 ? p.price : "",
    Box: p.boxNumber ?? "",
    "ID (mm)": p.insideDiameterMm ?? "",
    "CS (mm)": p.crossSectionMm ?? "",
    Notes: p.notes ?? "",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 36 },
    { wch: 28 },
    { wch: 32 },
    { wch: 8 },
    { wch: 22 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 24 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Inventory");
  XLSX.writeFile(book, name);
  return name;
}
