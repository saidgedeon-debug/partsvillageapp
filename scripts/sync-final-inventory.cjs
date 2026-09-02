/**
 * Sync FINAL new inventory.xlsx → live Supabase inventory.
 * - Existing catalog/custom seals: SET qty to file qty (adjusted)
 * - New codes: CREATE as Seals custom parts with file qty
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const FILE = "c:/Users/saidg/OneDrive/Desktop/FINAL new inventory.xlsx";
const KEY = "inventory";

function loadEnvLocal() {
  const text = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

function normCode(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function keyCode(s) {
  return normCode(s).toLowerCase().replace(/\s+/g, " ");
}

function toQty(v) {
  if (v === undefined || v === null || String(v).trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function newId() {
  return `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function slugId(code) {
  return (
    "seal-" +
    keyCode(code)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
  );
}

/** Parse FINAL workbook → [{ code, qty, name, subcategory, sheet }] */
function parseFinal(filePath) {
  const wb = XLSX.readFile(filePath);
  const out = [];

  const push = (code, qty, name, subcategory, sheet) => {
    const c = normCode(code);
    if (!c || c.length < 2) return;
    if (/^(no\.?|wr size|outer|inner|height|stock|total|qty|hbty)$/i.test(c)) return;
    if (/^piston seal|^oil seal|^dust|^buffer|^center joint|^n4w -|^\(o-ring\)/i.test(c)) return;
    out.push({
      code: c,
      qty: toQty(qty),
      name: name || c,
      subcategory,
      sheet,
    });
  };

  for (const sheetName of wb.SheetNames) {
    const sheet = sheetName.trim();
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    if (!raw.length) continue;

    // WR — structured
    if (sheet === "WR") {
      const header = raw[0].map((h) => String(h).trim().toLowerCase());
      const iSize = header.findIndex((h) => h.includes("wr size"));
      const iTotal = header.findIndex((h) => h.includes("total"));
      const iS1 = header.findIndex((h) => h.includes("stock 1"));
      const iS2 = header.findIndex((h) => h.includes("stock 2"));
      const iOd = header.findIndex((h) => h.includes("outer"));
      const iId = header.findIndex((h) => h.includes("inner"));
      const iH = header.findIndex((h) => h.includes("height"));
      for (let r = 1; r < raw.length; r++) {
        const row = raw[r];
        const code = row[iSize];
        if (!code) continue;
        let qty = 0;
        if (iTotal >= 0 && row[iTotal] !== "") qty = toQty(row[iTotal]);
        else qty = toQty(row[iS1]) + toQty(row[iS2]);
        const od = row[iOd];
        const id = row[iId];
        const h = row[iH];
        const name =
          od !== "" && id !== "" && h !== ""
            ? `Wear Ring ${normCode(code)} · ${od}×${id}×${h} mm`
            : `Wear Ring ${normCode(code)}`;
        push(code, qty, name, "Wear Ring", sheet);
      }
      continue;
    }

    // BR — first col code, second col qty (no header row)
    if (sheet === "BR") {
      for (const row of raw) {
        const code = row[0];
        const qty = row[1];
        if (!code || !/BR/i.test(String(code))) continue;
        push(code, qty, `Backup Ring ${normCode(code)}`, "Backup Ring", sheet);
      }
      continue;
    }

    // U H RING — col0 code, col1 type, col2 qty (header row 0)
    if (sheet === "U H RING") {
      for (let r = 1; r < raw.length; r++) {
        const row = raw[r];
        const code = row[0];
        if (!code) continue;
        push(code, row[2], `U-Ring ${normCode(code)}`, "U-Ring", sheet);
      }
      continue;
    }

    // Generic: skip title row, code in col0, qty in last numeric-ish col
    const title = String(raw[0]?.[0] || "");
    let subcategory = sheet;
    if (/glyd|gl ring/i.test(title) || sheet === "GLYD GL") subcategory = "Glyd Ring";
    else if (/slipper|sl /i.test(sheet)) subcategory = "Slipper Seal";
    else if (/^ok/i.test(sheet)) subcategory = "OK Seal";
    else if (sheet === "SPG") subcategory = "SPG Piston Seal";
    else if (sheet === "SPGW") subcategory = "SPGW Piston Seal";
    else if (sheet === "TCN") subcategory = "TCN Oil Seal";
    else if (sheet === "ROI") subcategory = "ROI Center Joint";
    else if (sheet === "N4W") subcategory = "N4W";
    else if (sheet === "T3G") subcategory = "T3G Backup Ring";
    else if (sheet === "T3P") subcategory = "T3P Backup Ring";
    else if (/HBY/i.test(sheet)) subcategory = "HBY Buffer Seal";
    else if (/DKBI/i.test(sheet)) subcategory = "DKBI Dust Wiper";
    else if (/DWIR/i.test(sheet)) subcategory = "DWIR Dust Seal";
    else if (/DWI/i.test(sheet)) subcategory = "DWI Dust Seal";
    else if (/HBTY/i.test(sheet)) subcategory = "HBTY";

    for (let r = 0; r < raw.length; r++) {
      const row = raw[r];
      const a = row[0];
      const b = row[1];
      const c = row[2];
      if (a === "" || a == null) continue;
      const label = String(a).trim();
      // skip section titles
      if (
        /seal|wiper|ring|joint|n4w -|^\(o-ring\)|^hbty$/i.test(label) &&
        !/\d/.test(label) &&
        r === 0
      ) {
        continue;
      }
      if (!/\d/.test(label) && r === 0) continue;
      if (/^hbty$/i.test(label)) continue;

      // qty: prefer last column that looks numeric
      let qty = "";
      if (c !== "" && Number.isFinite(Number(c))) qty = c;
      else if (b !== "" && Number.isFinite(Number(b))) qty = b;
      else if (typeof b === "number") qty = b;
      else if (typeof c === "number") qty = c;

      // SPG/HBY/DKBI: col1 is description text, col2 is qty
      if (
        (sheet === "SPG" || /HBY|DKBI/i.test(sheet)) &&
        c !== "" &&
        Number.isFinite(Number(c))
      ) {
        qty = c;
      }
      // TCN / DWI often have text in col1, no qty → 0
      if (
        (sheet === "TCN" || /DWI/i.test(sheet)) &&
        typeof b === "string" &&
        b &&
        !Number.isFinite(Number(b))
      ) {
        qty = c !== "" ? c : "";
      }

      const nameBase =
        subcategory === "Glyd Ring"
          ? `Glyd Ring ${normCode(label)}`
          : subcategory === "Slipper Seal"
            ? `Slipper Seal ${normCode(label)}`
            : subcategory === "OK Seal"
              ? `OK Seal ${normCode(label)}`
              : `${subcategory} ${normCode(label)}`;

      push(label, qty, nameBase, subcategory, sheet);
    }
  }

  // Dedupe by code — last wins (shouldn't conflict)
  const map = new Map();
  for (const row of out) map.set(keyCode(row.code), row);
  return [...map.values()];
}

/** Extract catalog seal parts from seals-inventory.ts source */
function loadCatalogSeals() {
  const text = fs.readFileSync(
    path.join(process.cwd(), "src/lib/seals-inventory.ts"),
    "utf8",
  );
  const parts = [];
  const blocks = text.split(/\n\s*\{\n/).slice(1);
  for (const block of blocks) {
    const id = block.match(/id:\s*"([^"]+)"/)?.[1];
    const partNumber = block.match(/partNumber:\s*"([^"]+)"/)?.[1];
    const name = block.match(/name:\s*"([^"]+)"/)?.[1];
    const quantity = Number(block.match(/quantity:\s*(-?\d+)/)?.[1] ?? 0);
    const subcategory = block.match(/subcategory:\s*"([^"]+)"/)?.[1];
    if (!id || !partNumber) continue;
    parts.push({ id, partNumber, name, quantity, subcategory });
  }
  return parts;
}

async function main() {
  const env = loadEnvLocal();
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  const rows = parseFinal(FILE);
  console.log(`Parsed ${rows.length} unique codes from FINAL`);

  const catalog = loadCatalogSeals();
  console.log(`Catalog seals: ${catalog.length}`);
  const byCode = new Map();
  for (const p of catalog) byCode.set(keyCode(p.partNumber), p);

  const { data, error } = await sb
    .from("shop_state")
    .select("value, updated_at")
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;

  const store =
    data?.value && typeof data.value === "object"
      ? data.value
      : { overrides: {}, customParts: [], customCategories: [] };
  store.overrides = store.overrides || {};
  store.customParts = Array.isArray(store.customParts) ? [...store.customParts] : [];
  store.customCategories = Array.isArray(store.customCategories)
    ? store.customCategories
    : [];

  // Index custom parts
  const customByCode = new Map();
  for (const p of store.customParts) {
    customByCode.set(keyCode(p.partNumber), p);
    for (const n of p.partNumbers || []) customByCode.set(keyCode(n), p);
  }

  let qtyAdjusted = 0;
  let created = 0;
  let unchanged = 0;
  const createdList = [];
  const adjustedList = [];

  for (const row of rows) {
    const k = keyCode(row.code);
    const cat = byCode.get(k);
    const custom = customByCode.get(k);

    if (cat) {
      const prevOverride = store.overrides[cat.id] || {};
      const currentQty =
        prevOverride.quantity !== undefined
          ? Number(prevOverride.quantity)
          : Number(cat.quantity) || 0;
      if (currentQty === row.qty) {
        unchanged += 1;
        continue;
      }
      store.overrides[cat.id] = {
        ...prevOverride,
        quantity: row.qty,
      };
      qtyAdjusted += 1;
      adjustedList.push({
        code: row.code,
        from: currentQty,
        to: row.qty,
        via: "catalog-override",
      });
      continue;
    }

    if (custom) {
      const currentQty = Number(custom.quantity) || 0;
      if (currentQty === row.qty) {
        unchanged += 1;
        continue;
      }
      custom.quantity = row.qty;
      qtyAdjusted += 1;
      adjustedList.push({
        code: row.code,
        from: currentQty,
        to: row.qty,
        via: "custom",
      });
      continue;
    }

    // New part
    const part = {
      id: slugId(row.code),
      partNumber: row.code,
      partNumbers: [row.code],
      name: row.name,
      category: "Seals",
      subcategory: row.subcategory,
      quantity: row.qty,
      reorderAt: row.qty > 0 ? Math.max(1, Math.min(5, Math.floor(row.qty / 10))) : 0,
      cost: 0,
      price: 0,
      compatibility: [],
      notes: `From FINAL new inventory.xlsx · sheet ${row.sheet}`,
    };
    // ensure unique id
    if (store.customParts.some((p) => p.id === part.id) || byCode.has(k)) {
      part.id = newId();
    }
    store.customParts.push(part);
    customByCode.set(k, part);
    created += 1;
    createdList.push({ code: row.code, qty: row.qty, subcategory: row.subcategory });
  }

  if (
    !store.customCategories.some(
      (c) => c.label === "Seals" || c.id === "seals",
    )
  ) {
    store.customCategories.push({
      id: "seals",
      label: "Seals",
      description: "Hydraulic seals & wear rings",
    });
  }

  const updatedAt = new Date().toISOString();
  const { error: upErr } = await sb.from("shop_state").upsert({
    key: KEY,
    value: store,
    updated_at: updatedAt,
  });
  if (upErr) throw upErr;

  // Also patch seals-inventory.ts quantities for catalog matches (keeps seed in sync)
  // Skip full rewrite — overrides are source of truth in cloud. Optional note in report.

  const auditPath =
    "c:/Users/saidg/OneDrive/Desktop/FINAL new inventory - sync report.xlsx";
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(adjustedList),
    "Qty adjusted",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(createdList),
    "Created new",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        code: r.code,
        qty: r.qty,
        subcategory: r.subcategory,
        sheet: r.sheet,
      })),
    ),
    "All from file",
  );
  XLSX.writeFile(wb, auditPath);

  console.log(
    JSON.stringify(
      {
        parsed: rows.length,
        qtyAdjusted,
        created,
        unchanged,
        auditPath,
        sampleAdjusted: adjustedList.slice(0, 10),
        sampleCreated: createdList.slice(0, 15),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
