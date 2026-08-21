/**
 * Generate src/lib/seals-inventory.ts from:
 * 1) WR Inventory Excel (Wear Ring subcategory)
 * 2) new inventory.xlsx seal batches (qty 0)
 *
 * Usage:
 *   node scripts/generate-seals-inventory.mjs --wr "path/WR.xlsx" --new "path/new inventory.xlsx"
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const wrPath = arg("--wr");
const newPath = arg("--new");
if (!wrPath || !newPath) {
  console.error(
    'Usage: node scripts/generate-seals-inventory.mjs --wr "WR.xlsx" --new "new inventory.xlsx"',
  );
  process.exit(1);
}

/** Batch header → English subcategory (ask user for anything not listed). */
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
};

/** Batches we skip until the user names the subcategory. */
const SKIP_BATCHES = new Set([
  "3자 SEAL (NYLON)",
  "3자 SEAL (RUBBER)",
  "스퀘어 펌프링",
]);

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

function loadWr(file) {
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
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
        "Wear ring · WR Inventory Clean Updated",
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
  // Bare part codes with empty type stay under the previous batch (e.g. SPG160).
  if (
    /^(SPG|SPGW|HBY|HBTY|HBTZ|DKBI|DWIR?|OHM|OUY|PPY)\d/i.test(a) ||
    /^(T3[GP]|HP|ROI)\s*\d/i.test(a) ||
    /^(GL|SL)\s+RING/i.test(a) ||
    /^SL\s+SEAL/i.test(a) ||
    /^N4W\d/i.test(a)
  ) {
    return false;
  }
  return true;
}

function loadNewSeals(file) {
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: "",
  });
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

    // Korean-labeled lines need an English subcategory from the user
    if (/[가-힣]/.test(a) || /[가-힣]/.test(b)) {
      skipped.push({ batch, code: a, type: b, row: i + 1 });
      unknownBatches.add(batch ? `${batch} → ${a}` : a);
      continue;
    }

    if (SKIP_BATCHES.has(batch) || SKIP_BATCHES.has(a)) {
      skipped.push({ batch, code: a, type: b, row: i + 1 });
      continue;
    }

    if (!batch || !BATCH_SUBCATEGORY[batch]) {
      skipped.push({ batch, code: a, type: b, row: i + 1 });
      unknownBatches.add(batch || `(no batch) ${a}`);
      continue;
    }

    const partNumber = a.replace(/\s+/g, " ").trim();
    const key = partNumber.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const subcategory = BATCH_SUBCATEGORY[batch];
    const typeLabel = b || subcategory;
    parts.push({
      id: slugId("seal", partNumber),
      partNumber,
      name: `${partNumber} · ${typeLabel}`,
      subcategory,
      quantity: 0,
      notes: `Batch: ${batch} · Type: ${typeLabel} · qty TBD`,
    });
  }

  return { parts, skipped, unknownBatches: [...unknownBatches] };
}

const wrParts = loadWr(wrPath);
const { parts: newParts, skipped, unknownBatches } = loadNewSeals(newPath);

const all = [...wrParts, ...newParts];
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

const out = `/** Seals catalog: Wear Rings (WR sheet) + hydraulic seal batches (new inventory.xlsx). Qtys for new batches TBD. */
import type { Part } from "@/lib/mock-data";

export const sealParts: Part[] = [
${lines.join(",\n")},
];
`;

const dest = path.join("src", "lib", "seals-inventory.ts");
fs.writeFileSync(dest, out);

const bySub = {};
for (const p of all) bySub[p.subcategory] = (bySub[p.subcategory] || 0) + 1;
console.log(`wrote ${dest}`);
console.log(`total ${all.length} (WR ${wrParts.length} + new ${newParts.length})`);
console.log("by subcategory:", bySub);
console.log("skipped (need subcategory name):", skipped.length);
for (const s of skipped) console.log("  ·", s);
if (unknownBatches.length) {
  console.log("unknown batches:", unknownBatches);
}
