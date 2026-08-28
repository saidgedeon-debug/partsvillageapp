/**
 * Generate src/lib/seals-inventory.ts from FINAL new inventory.xlsx
 *
 * Sheets:
 *   Sheet2     — master seal catalog (qty 0 unless matched on qty sheets)
 *   WR         — Wear Rings with stock
 *   HBY SEAL   — HBY buffer seal qty overlay
 *   U H RING   — U-ring qty overlay
 *   DUST SEAL  — DKBI dust wiper qty overlay
 *   BRT        — backup ring qty overlay
 *
 * Usage:
 *   node scripts/generate-seals-inventory.mjs --final "path/FINAL new inventory.xlsx"
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const finalPath = arg("--final");
const wrPath = arg("--wr");
const newPath = arg("--new");

if (!finalPath && !(wrPath && newPath)) {
  console.error(
    'Usage: node scripts/generate-seals-inventory.mjs --final "FINAL new inventory.xlsx"',
  );
  process.exit(1);
}

/** Batch header → English subcategory. */
const BATCH_SUBCATEGORY = {
  "PISTON SEAL - SPGW": "SPGW",
  "PISTON SEAL - SPG": "SPG",
  "PISTON SEAL - GLYD RING": "Glyd Ring",
  "PISTON SEAL - SLIPPER SEAL": "Slipper Seal",
  "PISTON SEAL - OK SEAL": "OK Seal",
  "DUST WIPER - DKBI": "DKBI",
  "DUST SEAL -DWIR": "DWIR",
  "DUST SEAL -DWI": "DWI",
  "BUFFER SEAL - HBY": "HBY",
  "BUFFER SEAL - STEP SEAL": "Step Seal",
  "BUFFER SEAL - HBTY": "HBTY",
  "BUFFER SEAL - HBTZ": "HBTZ",
  "ROD SEAL - HP SEAL": "HP Seal",
  "CENTER JOINT SEAL - ROI": "ROI",
  "(U-RING) BACK UP RING - BACK UP RING": "Back Up Ring (U-Ring)",
  "DUST RING - DUST RING": "Dust Ring",
  "(O-RING) BACK UP RING - T3G": "T3G",
  "(O-RING) BACK UP RING - T3P": "T3P",
  "(O-RING) BACK UP RING T3AN": "T3AN",
  "N4W - N4W": "N4W",
  "PISTON SEAL - OHM": "OHM",
  "OIL SEAL - TCN (CLOSE TYPE)": "TCN",
  "CENTER JOINT DUST SEAL - PPY": "PPY",
  "TRACK SEAL - OUY": "OUY",
  // Korean labels → English
  "3자 SEAL (NYLON)": "Nylon Triple Seal",
  "3자 SEAL (RUBBER)": "Rubber Triple Seal",
  "스퀘어 펌프링": "Square Pump Ring",
  "8자 PUMP RING": "Figure-8 Pump Ring",
};

/** Korean product codes → English part numbers (display + catalog). */
const KOREAN_PART_EN = {
  "3자 SEAL (NYLON)": "Nylon Triple Seal",
  "3자 SEAL (RUBBER)": "Rubber Triple Seal",
  "스퀘어 펌프링": "Square Pump Ring",
  "8자 PUMP RING": "Figure-8 Pump Ring",
};

function toEnglishPartNumber(code) {
  const t = String(code).replace(/\s+/g, " ").trim();
  if (KOREAN_PART_EN[t]) return KOREAN_PART_EN[t];
  const key = Object.keys(KOREAN_PART_EN).find(
    (k) => k.replace(/\s+/g, " ").trim() === t,
  );
  if (key) return KOREAN_PART_EN[key];
  return t;
}

function parseWrSize(wr) {
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

function slugId(prefix, code) {
  const s = String(code)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${s}`.slice(0, 80);
}

function normalizePartKey(code) {
  return String(code)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/x/gi, "*");
}

function cellNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function loadWrFromSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const parts = [];
  const seen = new Set();
  for (const r of rows) {
    const wr = String(r["WR Size"] ?? "").trim();
    if (!wr) continue;
    const parsed = parseWrSize(wr);
    if (!parsed) continue;
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
    if (seen.has(key)) continue;
    seen.add(key);
    const qtyRaw = r["Total Stock Qty"];
    const qty = Number.isFinite(Number(qtyRaw)) ? Math.max(0, Math.round(Number(qtyRaw))) : 0;
    const s1 = Number.isFinite(Number(r["Stock 1 Qty"])) ? Math.round(Number(r["Stock 1 Qty"])) : 0;
    const s2 = Number.isFinite(Number(r["Stock 2 Qty"])) ? Math.round(Number(r["Stock 2 Qty"])) : 0;
    parts.push({
      id: `seal-wr-${odS}-${idS}-${hS}`.replace(/\./g, "p"),
      partNumber,
      name: `Wear Ring ${partNumber} · ${odS}×${idS}×${hS} mm`,
      subcategory: "Wear Ring",
      quantity: qty,
      insideDiameterMm: idS,
      crossSectionMm: hS,
      notes: [
        `OD ${odS} × ID ${idS} × H ${hS} mm`,
        s1 || s2 ? `Stock1 ${s1} · Stock2 ${s2}` : null,
        "Wear ring · FINAL new inventory",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return parts;
}

function isBatchHeader(a, b) {
  if (b) return false;
  if (!a) return false;
  if (a.toLowerCase() === "description") return false;
  if (BATCH_SUBCATEGORY[a]) return true;
  if (
    /^(SPG|SPGW|HBY|HBTY|HBTZ|DKBI|DWIR?|OHM|OUY|PPY)\d/i.test(a) ||
    /^(T3[GP]|HP|ROI)\s*\d/i.test(a) ||
    /^(GL|SL)\s+RING/i.test(a) ||
    /^SL\s+SEAL/i.test(a) ||
    /^N4W\d/i.test(a) ||
    /^8자|^3자|^스퀘어/i.test(a)
  ) {
    return false;
  }
  return true;
}

function englishBatch(batch) {
  if (!batch) return null;
  if (BATCH_SUBCATEGORY[batch]) return BATCH_SUBCATEGORY[batch];
  // Fuzzy: strip extra spaces
  const key = Object.keys(BATCH_SUBCATEGORY).find(
    (k) => k.replace(/\s+/g, " ").trim() === batch.replace(/\s+/g, " ").trim(),
  );
  return key ? BATCH_SUBCATEGORY[key] : null;
}

function loadCatalogSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const parts = [];
  const seen = new Set();
  const skipped = [];
  const unknownBatches = new Set();
  let batch = null;

  for (let i = 0; i < rows.length; i++) {
    const a = String(rows[i][0] ?? "").trim();
    const b = String(rows[i][1] ?? "").trim();
    if (!a) continue;
    if (a.toLowerCase() === "description") continue;

    if (isBatchHeader(a, b)) {
      batch = a;
      continue;
    }

    const subcategory = englishBatch(batch);
    if (!batch || !subcategory) {
      skipped.push({ batch, code: a, type: b, row: i + 1 });
      unknownBatches.add(batch || `(no batch) ${a}`);
      continue;
    }

    const rawCode = a.replace(/\s+/g, " ").trim();
    const partNumber = toEnglishPartNumber(rawCode);
    const key = partNumber.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Keep Korean alias so qty overlays still match
    const aliases = [rawCode, partNumber].filter(
      (c, i, arr) => arr.indexOf(c) === i,
    );

    // Prefer English type labels
    let typeLabel = b || subcategory;
    if (/[가-힣]/.test(typeLabel)) typeLabel = subcategory;

    parts.push({
      id: slugId("seal", partNumber),
      partNumber,
      name:
        partNumber === typeLabel
          ? partNumber
          : `${partNumber} · ${typeLabel}`,
      subcategory,
      quantity: 0,
      aliases,
      notes: `Batch: ${subcategory} · Type: ${typeLabel} · FINAL new inventory`,
    });
  }

  return { parts, skipped, unknownBatches: [...unknownBatches] };
}

/** Build partNumber → qty from dedicated qty sheets. */
function loadQtyOverlays(wb) {
  const qtyByKey = new Map();

  const add = (code, qty) => {
    const n = cellNum(qty);
    if (n == null || n < 0) return;
    const key = normalizePartKey(code);
    if (!key) return;
    qtyByKey.set(key, Math.max(0, Math.round(n)));
  };

  // HBY SEAL: code | type | qty
  if (wb.Sheets["HBY SEAL"]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["HBY SEAL"], { header: 1, defval: "" });
    for (const r of rows) {
      const code = String(r[0] ?? "").trim();
      if (!code || /buffer seal/i.test(code)) continue;
      add(code, r[2]);
    }
  }

  // U H RING: code | U-RING | qty
  if (wb.Sheets["U H RING"]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["U H RING"], { header: 1, defval: "" });
    for (const r of rows) {
      const code = String(r[0] ?? "").trim();
      if (!code || code.toLowerCase() === "qty" || !code) continue;
      if (!String(r[1] ?? "").trim() && !cellNum(r[2])) continue;
      add(code, r[2]);
    }
  }

  // DUST SEAL: code | DUST WIPER | qty
  if (wb.Sheets["DUST SEAL"]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["DUST SEAL"], { header: 1, defval: "" });
    for (const r of rows) {
      const code = String(r[0] ?? "").trim();
      if (!code || /dust wiper/i.test(code)) continue;
      add(code, r[2]);
    }
  }

  // BRT: code | qty
  if (wb.Sheets["BRT"]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["BRT"], { header: 1, defval: "" });
    for (const r of rows) {
      const code = String(r[0] ?? "").trim();
      if (!code) continue;
      add(code, r[1]);
    }
  }

  return qtyByKey;
}

function applyQtyOverlay(parts, qtyByKey) {
  let hit = 0;
  for (const p of parts) {
    const candidates = [p.partNumber, ...(p.aliases || [])];
    let qty = null;
    for (const c of candidates) {
      const key = normalizePartKey(c);
      if (qtyByKey.has(key)) {
        qty = qtyByKey.get(key);
        break;
      }
    }
    if (qty != null) {
      p.quantity = qty;
      hit += 1;
      if (p.quantity > 0) {
        p.notes = `${p.notes.replace(/ · qty TBD$/, "")} · qty ${p.quantity}`;
      }
    }
  }
  return hit;
}

/** Parts that exist only on qty sheets (not Sheet2) — still import them. */
function partsFromQtySheetsOnly(wb, existingKeys) {
  const extra = [];
  const seen = new Set(existingKeys);

  const push = (code, typeLabel, subcategory, qty) => {
    const partNumber = String(code).replace(/\s+/g, " ").trim();
    if (!partNumber) return;
    const key = partNumber.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const q = cellNum(qty);
    extra.push({
      id: slugId("seal", partNumber),
      partNumber,
      name: `${partNumber} · ${typeLabel}`,
      subcategory,
      quantity: q != null && q > 0 ? Math.round(q) : 0,
      notes: `From qty sheet · ${subcategory} · FINAL new inventory`,
    });
  };

  if (wb.Sheets["HBY SEAL"]) {
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets["HBY SEAL"], { header: 1, defval: "" })) {
      const code = String(r[0] ?? "").trim();
      if (!code || /buffer seal/i.test(code)) continue;
      push(code, "BUFFER SEAL", "HBY", r[2]);
    }
  }
  if (wb.Sheets["U H RING"]) {
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets["U H RING"], { header: 1, defval: "" })) {
      const code = String(r[0] ?? "").trim();
      if (!code || !String(r[1] ?? "").trim()) continue;
      push(code, "U-RING", "U-Ring", r[2]);
    }
  }
  if (wb.Sheets["DUST SEAL"]) {
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets["DUST SEAL"], { header: 1, defval: "" })) {
      const code = String(r[0] ?? "").trim();
      if (!code || /dust wiper/i.test(code)) continue;
      push(code, "DUST WIPER", "DKBI", r[2]);
    }
  }
  if (wb.Sheets["BRT"]) {
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets["BRT"], { header: 1, defval: "" })) {
      const code = String(r[0] ?? "").trim();
      if (!code) continue;
      push(code, "BRT", "BRT", r[1]);
    }
  }

  return extra;
}

// --- main ---
let wrParts;
let catalogParts;
let skipped = [];
let unknownBatches = [];
let qtyHits = 0;
let extraFromQty = [];

if (finalPath) {
  const wb = XLSX.readFile(finalPath);
  const catalogSheet =
    wb.Sheets["Sheet2"] || wb.Sheets[wb.SheetNames.find((n) => n !== "WR") || wb.SheetNames[0]];
  wrParts = loadWrFromSheet(wb.Sheets["WR"] || wb.Sheets[wb.SheetNames[0]]);
  const loaded = loadCatalogSheet(catalogSheet);
  catalogParts = loaded.parts;
  skipped = loaded.skipped;
  unknownBatches = loaded.unknownBatches;

  const qtyByKey = loadQtyOverlays(wb);
  qtyHits = applyQtyOverlay(catalogParts, qtyByKey);

  const existing = new Set(catalogParts.map((p) => p.partNumber.toLowerCase()));
  extraFromQty = partsFromQtySheetsOnly(wb, existing);
  // Apply qty already set in partsFromQtySheetsOnly
} else {
  const wrWb = XLSX.readFile(wrPath);
  wrParts = loadWrFromSheet(wrWb.Sheets[wrWb.SheetNames[0]]);
  const newWb = XLSX.readFile(newPath);
  const loaded = loadCatalogSheet(newWb.Sheets[newWb.SheetNames[0]]);
  catalogParts = loaded.parts;
  skipped = loaded.skipped;
  unknownBatches = loaded.unknownBatches;
}

const all = [...wrParts, ...catalogParts, ...extraFromQty];
const lines = all.map((p) => {
  const extra = [];
  if (p.insideDiameterMm != null) {
    extra.push(`    insideDiameterMm: ${JSON.stringify(p.insideDiameterMm)},`);
  }
  if (p.crossSectionMm != null) {
    extra.push(`    crossSectionMm: ${JSON.stringify(p.crossSectionMm)},`);
  }
  return `  {
    id: ${JSON.stringify(p.id)},
    partNumber: ${JSON.stringify(p.partNumber)},
    name: ${JSON.stringify(p.name)},
    category: "Seals",
    subcategory: ${JSON.stringify(p.subcategory)},
    quantity: ${p.quantity},
    reorderAt: 0,
    cost: 0,
    price: 0,
    compatibility: [],
${extra.join("\n")}${extra.length ? "\n" : ""}    notes: ${JSON.stringify(p.notes)},
  }`;
});

const out = `/** Seals catalog from FINAL new inventory.xlsx (Wear Rings + seal batches). */
import type { Part } from "@/lib/mock-data";

export const sealParts: Part[] = [
${lines.join(",\n")},
];
`;

const dest = path.join("src", "lib", "seals-inventory.ts");
fs.writeFileSync(dest, out);

const bySub = {};
let withQty = 0;
for (const p of all) {
  bySub[p.subcategory] = (bySub[p.subcategory] || 0) + 1;
  if (p.quantity > 0) withQty += 1;
}
console.log(`wrote ${dest}`);
console.log(
  `total ${all.length} (WR ${wrParts.length} + catalog ${catalogParts.length} + qty-only ${extraFromQty.length})`,
);
console.log(`with qty > 0: ${withQty} · catalog qty overlays matched: ${qtyHits}`);
console.log("by subcategory:", bySub);
console.log("skipped:", skipped.length);
for (const s of skipped.slice(0, 30)) console.log("  ·", s);
if (skipped.length > 30) console.log(`  …and ${skipped.length - 30} more`);
if (unknownBatches.length) console.log("unknown batches:", unknownBatches);
