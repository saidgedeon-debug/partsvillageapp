/**
 * Upsert excavator air/intercooler hose SKUs into live shop_state inventory
 * with one piece of each in stock (quantity >= 1).
 *
 * - Exact OEM as SKU; no duplicate products.
 * - Reuse existing catalog/custom parts when SKU matches (trim + case-insensitive).
 * - Fill empty/incomplete name/description only; never overwrite cost or price if set.
 * - Ensure on-hand quantity is at least 1 (do not wipe higher stock; do not add stock
 *   repeatedly on re-run once already >= 1).
 * - Idempotent via SKU match + STOCK_MARKER notes.
 *
 * Usage:
 *   node --env-file=.env.local scripts/stock-excavator-air-hoses.mjs --yes
 *   node --env-file=.env.local scripts/stock-excavator-air-hoses.mjs --yes --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const YES = process.argv.includes("--yes");
const DRY_RUN = process.argv.includes("--dry-run");
if (!YES) {
  console.error("Refusing to write shop_state. Re-run with --yes after reviewing.");
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(
    "Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}

const STOCK_MARKER = "excavator-air-hose-stock-v1";
const TARGET_QTY = 1;
const CATEGORY = "Hoses / Air Intake & Intercooler";

/**
 * Source: Excavator_Air_Hose_Part_Numbers.xlsx (WPS share).
 * Duplicate sheet row for 5I-7546 is merged into one inventory product.
 * VOE* / cross-ref codes are stored as alternate partNumbers when provided.
 */
const PARTS = [
  {
    sku: "224-6847",
    name: "Caterpillar 82.5 mm Air Hose",
    description: "82.5 mm inner-diameter air hose",
    brand: "Caterpillar",
    system: "Air intake / charge air",
    engine: "3066 / C6.4",
    machines: "320C, 320C L, 320D, 320D L",
  },
  {
    sku: "205-6687",
    name: "Caterpillar 716.5 mm Air Hose",
    description: "716.5 mm long air hose",
    brand: "Caterpillar",
    system: "Air intake / charge air",
    engine: "3066 / C6.4",
    machines: "320C, 320C L, 320D, 320D L",
  },
  {
    sku: "116-3118",
    name: "Caterpillar Turbocharger Air-Intake Hose",
    description: "Turbocharger air-intake hose / pipe",
    brand: "Caterpillar",
    system: "Turbocharger intake",
    engine: "3066",
    machines: "320B, 320B L, E320B, E320BL",
  },
  {
    sku: "162-6228",
    name: "Caterpillar Long Air-Intake Hose",
    description: "Long air-intake hose (non-intercooler version)",
    brand: "Caterpillar",
    system: "Engine air intake",
    engine: "3066",
    machines: "320C / E320C",
  },
  {
    sku: "204-0946",
    name: "Caterpillar 59.5 mm Air / Aftercooler Hose",
    description: "59.5 mm inner-diameter air / aftercooler hose",
    brand: "Caterpillar",
    system: "Air intake / charge air",
    engine: "3066 / C6.4",
    machines: "320C, 320C L, 320D, 323D L, 323D LN",
  },
  {
    sku: "7Y-1910",
    name: "Caterpillar Turbocharger Intake Hose",
    description: "Air hose / turbocharger intake hose",
    brand: "Caterpillar",
    system: "Turbocharger intake",
    engine: "3066",
    machines: "320, 320L, 320A, 320B, 320BL, E320B, E320BL",
  },
  {
    sku: "085-8397",
    name: "Caterpillar Air-Intake Hose 085-8397",
    description: "Air-intake hose / pipe; cross-reference E8001400",
    brand: "Caterpillar",
    system: "Engine air intake",
    engine: "3066",
    machines: "E312, E320, E320B; some listings also mention 320C",
  },
  {
    sku: "E8001400",
    name: "Aftermarket Cat Air-Intake Hose E8001400",
    description: "Air-intake hose / pipe; cross-reference 085-8397",
    brand: "Aftermarket (Caterpillar)",
    system: "Engine air intake",
    engine: "3066",
    machines: "E312, E320, E320B",
  },
  {
    sku: "20450248",
    name: "Volvo Inlet Manifold / Charge-Air Pipe",
    description: "Inlet manifold / charge-air pipe (supplier naming varies)",
    brand: "Volvo",
    system: "Air intake / charge air",
    engine: "D6D",
    machines: "EC160B, EC180B, EC210B; EW145B, EW160B, EW180B, EW200B",
    aliases: ["VOE20450248"],
  },
  {
    sku: "20450765",
    name: "Volvo Manifold Elbow / Intake Hose",
    description: "Manifold elbow / intake hose",
    brand: "Volvo",
    system: "Air intake manifold",
    engine: "D7D",
    machines: "EC240B, EC290B",
    aliases: ["VOE20450765"],
  },
  {
    sku: "190-5791",
    name: "Caterpillar 100.6 mm Air-Line Elbow",
    description: "100.6 mm inner-diameter air-line elbow",
    brand: "Caterpillar",
    system: "Air intake / charge air",
    engine: "3126 / C7",
    machines: "322C, 325C, M325C MH; also listed on selected 324D–329D",
  },
  {
    sku: "255-2866",
    name: "Caterpillar Turbocharger / Air-Intake Hose",
    description: "Turbocharger / air-intake hose",
    brand: "Caterpillar",
    system: "Turbocharger intake",
    engine: "C7 / C7.1",
    machines: "324D, 324D L, 325D, 326D, 326D2, 329D, 330GC",
  },
  {
    sku: "E82001500",
    name: "Aftermarket Cat Air-Intake Hose E82001500",
    description: "Air-intake hose; often listed with E82001700",
    brand: "Aftermarket (Caterpillar)",
    system: "Engine air intake",
    engine: "3066",
    machines: "320B, E320B, 320BL, E320BL",
    aliases: ["E82001700"],
  },
  {
    sku: "204-1045",
    name: "Caterpillar 75 mm Turbocharger Air Hose",
    description: "75 mm inner-diameter turbocharger air hose",
    brand: "Caterpillar",
    system: "Turbocharger / charge air",
    engine: "C9",
    machines: "330C, 330C L, 330C LN, 330C FM, 330C MH",
  },
  {
    sku: "266-6216",
    name: "Caterpillar Turbocharger Intake Flexible Hose",
    description: "Turbocharger intake / flexible air hose",
    brand: "Caterpillar",
    system: "Turbocharger intake",
    engine: "C9",
    machines: "330D, 336D L, 336D, M336D",
  },
  {
    sku: "265-3591",
    name: "Caterpillar 50 mm Air-Lines Hose",
    description: "50 mm inner-diameter air-lines hose",
    brand: "Caterpillar",
    system: "Charge air / aftercooler",
    engine: "C6 / C6.4",
    machines: "320D, 320D L, 320D LN, 323D, 323D L, 323D LN",
  },
  {
    sku: "230-2933",
    name: "Caterpillar 75 mm Multiple-Bend Air Hose",
    description: "75 mm multiple-bend air hose",
    brand: "Caterpillar",
    system: "Air intake / charge air",
    engine: "C9",
    machines: "330D, 336D L/LN/FM/MH, 336D, 336D2, 340D, M336D",
  },
  {
    sku: "230-2866",
    name: "Caterpillar 75 mm Straight Air-Line Hose",
    description: "75 mm straight air-line / turbocharger hose",
    brand: "Caterpillar",
    system: "Air intake / charge air",
    engine: "C7 / C9 / C9.3",
    machines: "324D, 325D, 329D, 330D, 336D/336D2, 336E, 340D, 568, M325D",
  },
  {
    sku: "5I-7546",
    name: "Caterpillar Inlet / Turbo Outlet Hose 5I-7546",
    description:
      "Inlet-manifold air hose; also catalogued as turbocharger outlet hose / pipe",
    brand: "Caterpillar",
    system: "Engine air intake / turbocharger outlet",
    engine: "3064 / 3066",
    machines: "311, 312, 320, 320L; aftermarket also lists 320B and 320C",
  },
  {
    sku: "14611409",
    name: "Volvo Air-Cooler / Intercooler Hose",
    description: "Air-cooler / intercooler hose",
    brand: "Volvo",
    system: "Charge air / intercooler",
    engine: "D7D",
    machines: "EC240B, EC290B",
    aliases: ["VOE14611409"],
  },
  {
    sku: "20450250",
    name: "Volvo Charge-Air Pipe / Turbo Elbow",
    description: "Charge-air pipe / turbocharger elbow hose",
    brand: "Volvo",
    system: "Charge air / intercooler",
    engine: "D6D",
    machines: "EC210, EC210B, EC210BLC",
    aliases: ["VOE20450250"],
  },
  {
    sku: "14618181",
    name: "Volvo Air Charge-Cooler Hose",
    description: "Air charge-cooler hose",
    brand: "Volvo",
    system: "Charge air / intercooler",
    engine: "D6D",
    machines: "EC210, EC210B",
    aliases: ["VOE14618181"],
  },
  {
    sku: "14631951",
    name: "Volvo Intercooler Hose 14631951",
    description: "Intercooler hose",
    brand: "Volvo",
    system: "Charge air / intercooler",
    engine: "D7D",
    machines: "EC240B, EC290B (LC/NLC/LR variants)",
    aliases: ["VOE14631951"],
  },
  {
    sku: "14618183",
    name: "Volvo Turbo Elbow / Intercooler Hose",
    description: "Turbocharger elbow / intercooler air hose",
    brand: "Volvo",
    system: "Charge air / intercooler",
    engine: "D7D",
    machines: "EC240B, EC290B",
    aliases: ["VOE14618183"],
  },
  {
    sku: "14611408",
    name: "Volvo Intercooler Hose 14611408",
    description: "Intercooler hose / pipe",
    brand: "Volvo",
    system: "Charge air / intercooler",
    engine: "D6D",
    machines: "EC210B / EC240B (F/LC/LR/NLC variants)",
    aliases: ["VOE14611408"],
  },
  {
    sku: "6743-11-4930",
    name: "Komatsu Air-Intake Hose 6743-11-4930",
    description: "Air-intake hose; often superseded/paired with 6743-11-4931",
    brand: "Komatsu",
    system: "Air intake piping",
    engine: "SAA6D114E-2A",
    machines: "PC300-7, PC340-7, PC350-7, PC360-7, PC380-7, HG255-5",
    aliases: ["6743-11-4931"],
  },
  {
    sku: "6223-13-4730",
    name: "Komatsu Aftercooler / Intercooler Hose",
    description: "Aftercooler / intercooler hose; often cross-listed with 6223-13-4630",
    brand: "Komatsu",
    system: "Charge air / aftercooler",
    engine: "SAA6D108E",
    machines: "PC300-6, PC300LC-6, PC340-6R, PC350-6, PC380L-6K",
    aliases: ["6223-13-4630"],
  },
  {
    sku: "6738-11-4840",
    name: "Komatsu Intercooler Hose 6738-11-4840",
    description: "Intercooler hose",
    brand: "Komatsu",
    system: "Charge air / aftercooler",
    engine: "SAA6D107E-2",
    machines: "PC200-7, PC210-7, PC220-7, PC230-7, PC260-7",
  },
  {
    sku: "6743-11-4810",
    name: "Komatsu Inlet Intercooler Hose",
    description: "Inlet intercooler hose",
    brand: "Komatsu",
    system: "Charge air / intercooler",
    engine: "SAA6D114E-2",
    machines: "PC300-7, PC340-7, PC350-7, PC360-7, PC380-7",
  },
  {
    sku: "6738-11-4810",
    name: "Komatsu Intercooler Hose 6738-11-4810",
    description: "Intercooler hose",
    brand: "Komatsu",
    system: "Charge air / aftercooler",
    engine: "SAA6D102E-2",
    machines: "PC200-7, PC210-7, PC220-7, PC270-7, PC290NLC-7",
  },
  {
    sku: "207-01-72160",
    name: "Komatsu Air-Cleaner Connection Hose",
    description: "Air-cleaner connection hose",
    brand: "Komatsu",
    system: "Air cleaner / engine intake",
    engine: "SAA6D114E",
    machines: "PC300-7, PC340-7, PC350-7, PC360-7, PC380-7",
  },
  {
    sku: "208-01-72161",
    name: "Komatsu Air-Cleaner / Intake Hose",
    description: "Air-cleaner / intake hose",
    brand: "Komatsu",
    system: "Air cleaner / engine intake",
    engine: "SAA6D125",
    machines: "PC400-7/-8, PC450-7/-8, PC650LC-8",
  },
  {
    sku: "6130-12-8720",
    name: "Komatsu Breather / Rocker-Cover Hose",
    description: "Cylinder-head / rocker-cover hose (breather hose)",
    brand: "Komatsu",
    system: "Engine breather / head cover",
    engine: "6D102 / SAA6D102",
    machines: "PC200-7, PC220-7; also cataloged for PC300-7 and PC360-7",
  },
  {
    sku: "6738-11-4720",
    name: "Komatsu Aftercooler / Intercooler Hose 6738-11-4720",
    description: "Aftercooler / intercooler hose",
    brand: "Komatsu",
    system: "Charge air / aftercooler",
    engine: "6D102E / SAA6D102E",
    machines: "PC200-7, PC210-7, PC220-7, PC230-7, PC240-7, PC270-7, PC290-7",
  },
  {
    sku: "6743-11-4941",
    name: "Komatsu Intercooler Hose 6743-11-4941",
    description: "Intercooler hose; often paired with 6743-11-4940",
    brand: "Komatsu",
    system: "Charge air / aftercooler",
    engine: "SAA6D114E",
    machines: "PC300-7, PC340-7, PC350-7, PC360-7, PC380-7",
    aliases: ["6743-11-4940"],
  },
  {
    sku: "3183620",
    name: "Volvo Charge Air / Turbo Air Hose",
    description: "Charge air hose / flexible turbo air tube (VOE3183620)",
    brand: "Volvo",
    system: "Charge air / turbo intake",
    engine: "",
    machines: "EC210C, EC220D, EC240B, EC290B, EC330B, EC360B, EC460B and related",
    aliases: ["VOE3183620"],
  },
];

const EXPECTED_UNIQUE = 36; // 35 from hose sheet (5I-7546 merged) + Volvo 3183620

function normSku(s) {
  return String(s ?? "").replace(/\u00a0/g, " ").trim().toLowerCase();
}
function displaySku(s) {
  return String(s ?? "").replace(/\u00a0/g, " ").trim();
}
function isBlank(s) {
  return !String(s ?? "").trim();
}
function isIncompleteText(s, sku) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  if (normSku(t) === normSku(sku)) return true;
  return /^(n\/?a|unknown|tbd|todo)$/i.test(t);
}
function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadCatalogIndex(root) {
  const files = [
    "src/lib/orings-inventory.ts",
    "src/lib/seals-inventory.ts",
    "src/lib/couplings-inventory.ts",
    "src/lib/gauges-inventory.ts",
    "src/lib/hydraulics-inventory.ts",
    "src/lib/bearings-inventory.ts",
    "src/lib/filters-inventory.ts",
    "src/lib/misc-inventory.ts",
  ];
  const bySku = new Map();
  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    for (const block of text.split(/\n\s*\{/).slice(1)) {
      const id = block.match(/\bid:\s*"([^"]+)"/)?.[1];
      const partNumber = block.match(/\bpartNumber:\s*"([^"]+)"/)?.[1];
      if (!id || !partNumber) continue;
      const name = block.match(/\bname:\s*"([^"]*)"/)?.[1] ?? partNumber;
      const description = block.match(/\bdescription:\s*"([^"]*)"/)?.[1] ?? "";
      const category = block.match(/\bcategory:\s*"([^"]*)"/)?.[1] ?? "MISC";
      const quantity = Number(block.match(/\bquantity:\s*(-?\d+(?:\.\d+)?)/)?.[1] ?? 0);
      const cost = Number(block.match(/\bcost:\s*(-?\d+(?:\.\d+)?)/)?.[1] ?? 0);
      const price = Number(block.match(/\bprice:\s*(-?\d+(?:\.\d+)?)/)?.[1] ?? 0);
      const partNumbers = [partNumber];
      const arr = block.match(/\bpartNumbers:\s*\[([^\]]*)\]/)?.[1];
      if (arr) for (const m of arr.matchAll(/"([^"]+)"/g)) partNumbers.push(m[1]);
      const entry = {
        id,
        partNumber,
        partNumbers: [...new Set(partNumbers)],
        name,
        description,
        category,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        cost: Number.isFinite(cost) ? cost : 0,
        price: Number.isFinite(price) ? price : 0,
      };
      for (const code of entry.partNumbers) {
        const k = normSku(code);
        if (k && !bySku.has(k)) bySku.set(k, entry);
      }
    }
  }
  return bySku;
}

function effectivePart(catalogEntry, override) {
  const base = catalogEntry ?? {};
  const o = override ?? {};
  return {
    id: base.id || o.id,
    partNumber: o.partNumber ?? base.partNumber,
    partNumbers: o.partNumbers ?? base.partNumbers ?? [o.partNumber ?? base.partNumber],
    name: o.name ?? base.name ?? "",
    description: o.description ?? base.description ?? "",
    category: o.category ?? base.category ?? "MISC",
    quantity:
      typeof o.quantity === "number"
        ? o.quantity
        : typeof base.quantity === "number"
          ? base.quantity
          : 0,
    cost: typeof o.cost === "number" ? o.cost : typeof base.cost === "number" ? base.cost : 0,
    price: typeof o.price === "number" ? o.price : typeof base.price === "number" ? base.price : 0,
    notes: o.notes ?? base.notes ?? "",
    compatibility: o.compatibility ?? base.compatibility ?? [],
  };
}

const PRIMARY_SKUS = new Set(PARTS.map((p) => normSku(p.sku)));

function mergeAliases(existing, sku, aliases = []) {
  const nums = Array.isArray(existing) ? [...existing] : [];
  const add = [sku, ...aliases]
    .map(displaySku)
    .filter(Boolean)
    // Never attach another primary SKU as an alias — those are separate products.
    .filter((code) => normSku(code) === normSku(sku) || !PRIMARY_SKUS.has(normSku(code)));
  for (const code of add) {
    if (!nums.some((n) => displaySku(n) === code)) nums.push(code);
  }
  return nums;
}

function buildNotes(item) {
  return [
    item.brand ? `Brand: ${item.brand}` : null,
    item.system ? `System: ${item.system}` : null,
    item.engine ? `Engine: ${item.engine}` : null,
    item.machines ? `Machines: ${item.machines}` : null,
    `OEM: ${displaySku(item.sku)}`,
    STOCK_MARKER,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildCompatibility(item) {
  const bits = [];
  if (item.brand) bits.push(item.brand);
  if (item.machines) bits.push(item.machines);
  if (item.engine) bits.push(`Engine ${item.engine}`);
  return bits;
}

async function loadKey(sb, keyName, fallback) {
  const { data, error } = await sb
    .from("shop_state")
    .select("value, updated_at")
    .eq("key", keyName)
    .maybeSingle();
  if (error) throw error;
  return { value: data?.value ?? fallback, updatedAt: data?.updated_at ?? null };
}

async function saveKey(sb, keyName, value) {
  if (DRY_RUN) {
    console.log(`[dry-run] skip save ${keyName}`);
    return;
  }
  const { error } = await sb.from("shop_state").upsert({
    key: keyName,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

const seen = new Set();
for (const p of PARTS) {
  const k = normSku(p.sku);
  if (seen.has(k)) {
    console.error(`ABORT: duplicate SKU in seed list: ${p.sku}`);
    process.exit(1);
  }
  seen.add(k);
}
if (PARTS.length !== EXPECTED_UNIQUE) {
  console.error(`ABORT: expected ${EXPECTED_UNIQUE} unique SKUs, got ${PARTS.length}`);
  process.exit(1);
}

console.log(`Validated ${PARTS.length} unique SKUs · target on-hand >= ${TARGET_QTY}`);

const sb = createClient(url, key);
const catalogBySku = loadCatalogIndex(process.cwd());
console.log(`Catalog index: ${catalogBySku.size} SKU keys`);

const invRow = await loadKey(sb, "inventory", {
  overrides: {},
  customParts: [],
  customCategories: [],
});
const inventory = {
  overrides: { ...(invRow.value?.overrides ?? {}) },
  customParts: [...(invRow.value?.customParts ?? [])],
  customCategories: [...(invRow.value?.customCategories ?? [])],
};

if (!inventory.customCategories.some((c) => String(c).trim() === CATEGORY)) {
  inventory.customCategories.push(CATEGORY);
}

/** @type {Map<string, { kind: 'custom'|'catalog', id: string }>} */
const liveBySku = new Map();
for (const p of inventory.customParts) {
  for (const code of [p.partNumber, ...(Array.isArray(p.partNumbers) ? p.partNumbers : [])]) {
    const k = normSku(code);
    if (k && !liveBySku.has(k)) liveBySku.set(k, { kind: "custom", id: p.id });
  }
}
for (const [id, ov] of Object.entries(inventory.overrides)) {
  for (const code of [ov?.partNumber, ...(Array.isArray(ov?.partNumbers) ? ov.partNumbers : [])]) {
    const k = normSku(code);
    if (k && !liveBySku.has(k)) liveBySku.set(k, { kind: "catalog", id });
  }
}
for (const [k, entry] of catalogBySku) {
  if (!liveBySku.has(k)) liveBySku.set(k, { kind: "catalog", id: entry.id });
}

const created = [];
const reused = [];
const stocked = [];
const alreadyInStock = [];

for (const item of PARTS) {
  const sku = displaySku(item.sku);
  const skuKey = normSku(sku);
  const hit = liveBySku.get(skuKey);
  const notesExtra = buildNotes(item);
  const compatibility = buildCompatibility(item);
  const aliases = Array.isArray(item.aliases) ? item.aliases : [];

  if (hit?.kind === "custom") {
    const idx = inventory.customParts.findIndex((p) => p.id === hit.id);
    const current = inventory.customParts[idx];
    const patch = { ...current };
    patch.partNumber = sku;
    patch.partNumbers = mergeAliases(patch.partNumbers ?? [patch.partNumber], sku, aliases);
    if (isIncompleteText(patch.name, sku)) patch.name = item.name;
    if (isIncompleteText(patch.description, sku)) patch.description = item.description;
    if (isBlank(patch.category)) patch.category = CATEGORY;
    if (!Array.isArray(patch.compatibility) || patch.compatibility.length === 0) {
      patch.compatibility = compatibility;
    }
    if (isBlank(patch.notes) || !String(patch.notes).includes(STOCK_MARKER)) {
      patch.notes = isBlank(patch.notes) ? notesExtra : `${patch.notes} · ${STOCK_MARKER}`;
    }
    const beforeQty = Math.max(0, Math.round(Number(patch.quantity) || 0));
    if (beforeQty < TARGET_QTY) {
      patch.quantity = TARGET_QTY;
      stocked.push({ sku, id: patch.id, beforeQty, afterQty: TARGET_QTY });
    } else {
      alreadyInStock.push({ sku, id: patch.id, qty: beforeQty });
    }
    // Never overwrite existing cost/price.
    inventory.customParts[idx] = patch;
    reused.push({ sku, id: patch.id, action: "reused-custom", onHand: patch.quantity });
  } else if (hit?.kind === "catalog" || catalogBySku.has(skuKey)) {
    const catalog = catalogBySku.get(skuKey) || null;
    const id = hit?.id || catalog.id;
    const prevOv = inventory.overrides[id] ?? {};
    const effective = effectivePart(catalog, prevOv);
    const nextOv = { ...prevOv };
    nextOv.partNumber = sku;
    nextOv.partNumbers = mergeAliases(
      nextOv.partNumbers ?? effective.partNumbers,
      sku,
      aliases,
    );
    if (isIncompleteText(effective.name, sku)) nextOv.name = item.name;
    if (isIncompleteText(effective.description, sku)) nextOv.description = item.description;
    if (isBlank(effective.category)) nextOv.category = CATEGORY;
    if (!Array.isArray(effective.compatibility) || effective.compatibility.length === 0) {
      nextOv.compatibility = compatibility;
    }
    if (isBlank(effective.notes) || !String(effective.notes).includes(STOCK_MARKER)) {
      nextOv.notes = isBlank(effective.notes) ? notesExtra : `${effective.notes} · ${STOCK_MARKER}`;
    }
    const beforeQty = Math.max(0, Math.round(Number(effective.quantity) || 0));
    if (beforeQty < TARGET_QTY) {
      nextOv.quantity = TARGET_QTY;
      stocked.push({ sku, id, beforeQty, afterQty: TARGET_QTY });
    } else {
      alreadyInStock.push({ sku, id, qty: beforeQty });
    }
    inventory.overrides[id] = nextOv;
    reused.push({
      sku,
      id,
      action: "reused-catalog",
      onHand: nextOv.quantity ?? effective.quantity,
    });
  } else {
    const part = {
      id: newId("part"),
      partNumber: sku,
      partNumbers: mergeAliases([], sku, aliases),
      name: item.name,
      description: item.description,
      category: CATEGORY,
      quantity: TARGET_QTY,
      reorderAt: 0,
      cost: 0,
      price: 0,
      compatibility,
      notes: notesExtra,
    };
    inventory.customParts.push(part);
    liveBySku.set(skuKey, { kind: "custom", id: part.id });
    for (const code of part.partNumbers) {
      const k = normSku(code);
      if (k && !liveBySku.has(k)) liveBySku.set(k, { kind: "custom", id: part.id });
    }
    created.push({ sku, id: part.id, action: "created", onHand: TARGET_QTY });
    stocked.push({ sku, id: part.id, beforeQty: 0, afterQty: TARGET_QTY });
  }
}

const summary = {
  dryRun: DRY_RUN,
  marker: STOCK_MARKER,
  uniqueSkus: PARTS.length,
  created: created.length,
  reused: reused.length,
  stockedToOne: stocked.length,
  alreadyInStock: alreadyInStock.length,
  created,
  reused,
  stocked,
  alreadyInStock,
};

console.log(JSON.stringify(summary, null, 2));

await saveKey(sb, "inventory", inventory);

console.log(
  DRY_RUN
    ? "Dry-run complete — no writes."
    : `Saved inventory: ${created.length} created, ${reused.length} reused, ${stocked.length} set to qty ${TARGET_QTY}.`,
);
