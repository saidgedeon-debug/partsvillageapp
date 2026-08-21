/**
 * One-shot: generate src/lib/seals-inventory.ts from WR Inventory Excel.
 * Usage: node scripts/generate-seals-inventory.mjs "path/to/WR Inventory.xlsx"
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const excelPath = process.argv[2];
if (!excelPath) {
  console.error("Usage: node scripts/generate-seals-inventory.mjs <excel-path>");
  process.exit(1);
}

const wb = XLSX.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

function parseSize(wr) {
  const m = String(wr)
    .trim()
    .match(/^WR\s*([\d.]+)\s*[*x×]\s*([\d.]+)\s*[*x×]\s*([\d.]+)/i);
  if (!m) return null;
  return { od: m[1], id: m[2], h: m[3] };
}

function fmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n).trim();
  return String(x);
}

function slug(od, id, h) {
  return `seal-wr-${od}-${id}-${h}`.replace(/\./g, "p");
}

const parts = [];
const seen = new Set();
for (const r of rows) {
  const wr = String(r["WR Size"] ?? "").trim();
  if (!wr) continue;
  const parsed = parseSize(wr);
  if (!parsed) {
    console.error("skip unparsable", wr);
    continue;
  }
  let od = r["Outer Size"];
  let id = r["Inner Size"];
  let h = r["Height"];
  if (od === "" || od == null || !Number.isFinite(Number(od))) od = parsed.od;
  if (id === "" || id == null || !Number.isFinite(Number(id))) id = parsed.id;
  if (h === "" || h == null || !Number.isFinite(Number(h))) h = parsed.h;

  const odS = fmt(od);
  const idS = fmt(id);
  const hS = fmt(h);
  const partNumber = wr.replace(/\s+/g, "");
  const key = partNumber.toLowerCase();
  if (seen.has(key)) {
    console.error("dup", partNumber);
    continue;
  }
  seen.add(key);

  const qtyRaw = r["Total Stock Qty"];
  const qty = Number.isFinite(Number(qtyRaw)) ? Math.max(0, Math.round(Number(qtyRaw))) : 0;
  const s1 = Number.isFinite(Number(r["Stock 1 Qty"])) ? Math.round(Number(r["Stock 1 Qty"])) : 0;
  const s2 = Number.isFinite(Number(r["Stock 2 Qty"])) ? Math.round(Number(r["Stock 2 Qty"])) : 0;
  const noteBits = [
    `OD ${odS} × ID ${idS} × H ${hS} mm`,
    s1 || s2 ? `Stock1 ${s1} · Stock2 ${s2}` : null,
    "Wear ring · WR Inventory Clean Updated",
  ].filter(Boolean);

  parts.push({
    id: slug(odS, idS, hS),
    partNumber,
    name: `Wear Ring ${partNumber} · ${odS}×${idS}×${hS} mm`,
    quantity: qty,
    insideDiameterMm: idS,
    crossSectionMm: hS,
    notes: noteBits.join(" · "),
  });
}

const lines = parts.map(
  (p) => `  {
    id: ${JSON.stringify(p.id)},
    partNumber: ${JSON.stringify(p.partNumber)},
    name: ${JSON.stringify(p.name)},
    category: "Seals",
    subcategory: "Wear Rings",
    quantity: ${p.quantity},
    reorderAt: 0,
    cost: 0,
    price: 0,
    compatibility: [],
    insideDiameterMm: ${JSON.stringify(p.insideDiameterMm)},
    crossSectionMm: ${JSON.stringify(p.crossSectionMm)},
    notes: ${JSON.stringify(p.notes)},
  }`,
);

const out = `/** Wear rings (WR) from WR Inventory - Clean Updated.xlsx. Costs/prices TBD. */
import type { Part } from "@/lib/mock-data";

export const sealParts: Part[] = [
${lines.join(",\n")},
];
`;

const dest = path.join("src", "lib", "seals-inventory.ts");
fs.writeFileSync(dest, out);
console.log(`wrote ${dest}: ${parts.length} parts (${parts.filter((p) => p.quantity > 0).length} with stock)`);
