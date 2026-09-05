/**
 * Upsert Hamdan handwritten order into live shop_state.
 *
 * - Find existing client "Hamdan" (trim + case-insensitive). Never create a client.
 * - Upsert each SKU (catalog override or custom part). Never treat qty as stock-in.
 * - Do not overwrite existing purchase cost; set sell price only if missing/zero.
 * - Create/refresh one Draft quotation (idempotent). stockDeducted=false.
 * - Stock is deducted only when converting Draft → invoice in the app UI.
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-hamdan-draft-invoice.mjs --yes
 *   node --env-file=.env.local scripts/create-hamdan-draft-invoice.mjs --yes --dry-run
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

const ORDER_MARKER = "hamdan-handwritten-order-v1";
const EXPECTED_SUBTOTAL_CENTS = 1232340; // $12,323.40
const EXCLUDED_SKUS = new Set(["A0022505115", "A0022507215"].map((s) => s.toLowerCase()));
const QTY_WARNING =
  "Part 643331600: quantity 10 produces an invoice total of $12,323.40. Quantity 1 would produce $10,973.40.";
const CUSTOMER_NOTE =
  "Order transcribed from Hamdan’s handwritten confirmed order. Verify the quantity of part 643331600 and the final total before finalizing.";

const ORDER_LINES = [
  {
    sku: "500086727",
    name: "IVECO Steering Tie Rod",
    description: "Steering tie rod for IVECO Stralis and Trakker trucks",
    category: "Steering",
    quantity: 10,
    unitPrice: 26.0,
    lineTotal: 260.0,
  },
  {
    sku: "42577011",
    name: "IVECO Speed / RPM Sensor",
    description: "IVECO rotation or vehicle-speed sensor; also catalogued as an ABS speed sensor",
    category: "Sensors",
    quantity: 30,
    unitPrice: 10.0,
    lineTotal: 300.0,
  },
  {
    sku: "4837951",
    name: "IVECO Coolant Temperature Sensor",
    description: "Engine coolant temperature sensor, M16 \u00d7 1.5, for IVECO trucks",
    category: "Sensors",
    quantity: 25,
    unitPrice: 9.0,
    lineTotal: 225.0,
  },
  {
    sku: "3400121501",
    name: "SACHS 400 mm Double Clutch Kit",
    description: "Five-piece 400 mm twin-disc clutch kit for Mercedes-Benz heavy trucks",
    category: "Clutch Kits",
    quantity: 10,
    unitPrice: 221.0,
    lineTotal: 2210.0,
  },
  {
    sku: "643331600",
    name: "LuK 430 mm Clutch Kit",
    description:
      "Three-piece 430 mm clutch kit containing clutch disc, pressure plate and release bearing",
    category: "Clutch Kits",
    quantity: 10,
    unitPrice: 150.0,
    lineTotal: 1500.0,
    requiresConfirmation: true,
    confirmationNote:
      "The handwritten line says quantity 10, but the handwritten grand total appears to calculate this product as quantity 1.",
  },
  {
    sku: "504384724",
    name: "IVECO/FPT Coolant Thermostat",
    description: "Engine coolant thermostat for IVECO and FPT applications",
    category: "Cooling System",
    quantity: 20,
    unitPrice: 5.72,
    lineTotal: 114.4,
  },
  {
    sku: "SEAL-120X145X13-VITON",
    name: "Viton Crankshaft Oil Seal 120 \u00d7 145 \u00d7 13 mm",
    description:
      "Viton/FKM crankshaft oil seal, 120 mm inside diameter \u00d7 145 mm outside diameter \u00d7 13 mm width",
    category: "Oil Seals",
    quantity: 10,
    unitPrice: 5.8,
    lineTotal: 58.0,
  },
  {
    sku: "38212-00200/01",
    name: "Truck Spare Part 38212-00200/01",
    description:
      "Truck spare part with supplier reference 38212-00200/01; exact component description requires confirmation",
    category: "Truck Parts",
    quantity: 20,
    unitPrice: 1.0,
    lineTotal: 20.0,
    requiresDescriptionConfirmation: true,
  },
  {
    sku: "WVA19384",
    name: "Heavy-Truck Drum Brake Lining Set",
    description:
      "WVA 19384 drum brake shoe lining set for heavy trucks, including IVECO applications",
    category: "Brake Parts",
    quantity: 10,
    unitPrice: 16.0,
    lineTotal: 160.0,
  },
  {
    sku: "1878007072",
    name: "SACHS 430 mm Clutch Disc",
    description: "430 mm SACHS clutch disc for Mercedes-Benz heavy trucks",
    category: "Clutch Discs",
    quantity: 10,
    unitPrice: 58.0,
    lineTotal: 580.0,
  },
  {
    sku: "1878080037",
    name: "SACHS 430 mm Clutch Disc",
    description: "430 mm SACHS clutch disc for Mercedes-Benz, MAN and DAF heavy trucks",
    category: "Clutch Discs",
    quantity: 10,
    unitPrice: 58.0,
    lineTotal: 580.0,
  },
  {
    sku: "500372081",
    name: "IVECO 430 mm Clutch Disc",
    description: "430 mm, 10-tooth clutch disc for IVECO heavy trucks",
    category: "Clutch Discs",
    quantity: 10,
    unitPrice: 43.0,
    lineTotal: 430.0,
  },
  {
    sku: "500371283",
    name: "IVECO 430 mm Clutch Kit",
    description: "430 mm clutch kit for IVECO EuroStar, EuroTrakker and Stralis applications",
    category: "Clutch Kits",
    quantity: 10,
    unitPrice: 150.0,
    lineTotal: 1500.0,
  },
  {
    sku: "3482083113",
    name: "SACHS 430 mm Clutch Pressure Plate",
    description: "430 mm clutch pressure plate and cover for heavy-truck applications",
    category: "Clutch Pressure Plates",
    quantity: 10,
    unitPrice: 118.0,
    lineTotal: 1180.0,
  },
  {
    sku: "A0022507315",
    name: "Mercedes-Benz Clutch Release Bearing",
    description: "Central clutch slave cylinder with release bearing for Mercedes-Benz trucks",
    category: "Clutch Hydraulics",
    quantity: 10,
    unitPrice: 33.0,
    lineTotal: 330.0,
  },
  {
    sku: "A0022505815",
    name: "Mercedes-Benz Clutch Release Bearing",
    description:
      "Central clutch slave cylinder with release bearing for Mercedes-Benz trucks and buses",
    category: "Clutch Hydraulics",
    quantity: 10,
    unitPrice: 44.0,
    lineTotal: 440.0,
  },
  {
    sku: "A0022950706",
    name: "Mercedes-Benz Clutch Master Cylinder",
    description: "Clutch master cylinder for Mercedes-Benz commercial vehicles",
    category: "Clutch Hydraulics",
    quantity: 20,
    unitPrice: 12.7,
    lineTotal: 254.0,
  },
  {
    sku: "5801574722",
    name: "IVECO Clutch Master Cylinder / Booster",
    description:
      "Clutch master cylinder or clutch booster for IVECO Eurocargo, Tector and Astra applications",
    category: "Clutch Hydraulics",
    quantity: 2,
    unitPrice: 66.0,
    lineTotal: 132.0,
  },
  {
    sku: "9650019022",
    name: "WABCO Clutch Cylinder Repair Kit",
    description: "Repair kit for WABCO clutch master cylinder or clutch booster",
    category: "Clutch Repair Kits",
    quantity: 2,
    unitPrice: 35.0,
    lineTotal: 70.0,
  },
  {
    sku: "A0022950406",
    name: "Mercedes-Benz Clutch Master Cylinder",
    description: "Clutch master cylinder for Mercedes-Benz Actros commercial trucks",
    category: "Clutch Hydraulics",
    quantity: 30,
    unitPrice: 11.6,
    lineTotal: 348.0,
  },
  {
    sku: "3482000462",
    name: "SACHS 362 mm Clutch Pressure Plate",
    description: "362 mm clutch pressure plate and cover for Mercedes-Benz Atego applications",
    category: "Clutch Pressure Plates",
    quantity: 5,
    unitPrice: 44.0,
    lineTotal: 220.0,
  },
  {
    sku: "3482000464",
    name: "SACHS 395 mm Clutch Pressure Plate",
    description:
      "395 mm clutch pressure plate and cover for Mercedes-Benz Atego, Axor and MAN applications",
    category: "Clutch Pressure Plates",
    quantity: 5,
    unitPrice: 58.0,
    lineTotal: 290.0,
  },
  {
    sku: "1878052842",
    name: "SACHS 362 mm Clutch Disc",
    description: "362 mm, 18-tooth clutch disc for Mercedes-Benz Atego applications",
    category: "Clutch Discs",
    quantity: 5,
    unitPrice: 43.0,
    lineTotal: 215.0,
  },
  {
    sku: "1878023831",
    name: "SACHS 395 mm Clutch Disc",
    description: "395 mm, 18-tooth clutch disc for Mercedes-Benz Atego and Axor applications",
    category: "Clutch Discs",
    quantity: 5,
    unitPrice: 43.0,
    lineTotal: 215.0,
  },
  {
    sku: "5410101533",
    name: "Mercedes-Benz Flywheel Housing",
    description: "Flywheel housing for Mercedes-Benz Actros V6 and V8 heavy trucks",
    category: "Engine and Flywheel Parts",
    quantity: 2,
    unitPrice: 346.0,
    lineTotal: 692.0,
  },
];

function moneyToCents(n) {
  if (!Number.isFinite(n)) throw new Error(`Non-finite money: ${n}`);
  return Math.round((Number(n) + Number.EPSILON) * 100);
}
function centsToMoney(c) {
  return Math.round(c) / 100;
}
function roundMoney(n) {
  return centsToMoney(moneyToCents(n));
}
function normSku(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase();
}
function displaySku(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
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
function generateDocId(kind, date = new Date()) {
  const prefix = kind === "quotation" ? "Q" : kind === "invoice" ? "INV" : "DOC";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${y}${m}${d}-${hh}${mm}${ss}${ms}-${rand}`;
}

function validateLines(items) {
  const discrepancies = [];
  let subtotalCents = 0;
  for (const item of items) {
    if (EXCLUDED_SKUS.has(normSku(item.sku))) {
      discrepancies.push({ sku: item.sku, reason: "Excluded crossed-out SKU on invoice" });
      continue;
    }
    const lineCents = item.quantity * moneyToCents(item.unitPrice);
    const expected = moneyToCents(item.lineTotal);
    if (lineCents !== expected) {
      discrepancies.push({
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        calculated: centsToMoney(lineCents),
        lineTotal: item.lineTotal,
      });
    }
    subtotalCents += lineCents;
  }
  return { discrepancies, subtotalCents };
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
  };
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

const activeLines = ORDER_LINES.filter((i) => !EXCLUDED_SKUS.has(normSku(i.sku)));
const { discrepancies, subtotalCents } = validateLines(activeLines);
if (discrepancies.length) {
  console.error("ABORT: line total discrepancies:");
  console.error(JSON.stringify(discrepancies, null, 2));
  process.exit(1);
}
if (subtotalCents !== EXPECTED_SUBTOTAL_CENTS) {
  console.error(
    `ABORT: subtotal $${centsToMoney(subtotalCents)} !== expected $${centsToMoney(EXPECTED_SUBTOTAL_CENTS)}`,
  );
  process.exit(1);
}

console.log(`Validated ${activeLines.length} lines · subtotal $${centsToMoney(subtotalCents)}`);
console.log(`WARNING: ${QTY_WARNING}`);

const sb = createClient(url, key);
const catalogBySku = loadCatalogIndex(process.cwd());
console.log(`Catalog index: ${catalogBySku.size} SKU keys`);

const [partiesRow, invRow, docsRow] = await Promise.all([
  loadKey(sb, "parties", { clients: [], suppliers: [] }),
  loadKey(sb, "inventory", { overrides: {}, customParts: [], customCategories: [] }),
  loadKey(sb, "documents", []),
]);

const parties = {
  clients: [...(partiesRow.value?.clients ?? [])],
  suppliers: [...(partiesRow.value?.suppliers ?? [])],
};
const inventory = {
  overrides: { ...(invRow.value?.overrides ?? {}) },
  customParts: [...(invRow.value?.customParts ?? [])],
  customCategories: [...(invRow.value?.customCategories ?? [])],
};
const documents = Array.isArray(docsRow.value) ? [...docsRow.value] : [];

const hamdanMatches = parties.clients.filter(
  (c) =>
    String(c.name ?? "")
      .trim()
      .toLowerCase() === "hamdan",
);
if (hamdanMatches.length === 0) {
  console.error('ERROR: Client "Hamdan" not found. Invoice not created.');
  const near = parties.clients
    .filter((c) =>
      String(c.name ?? "")
        .toLowerCase()
        .includes("hamdan"),
    )
    .map((c) => ({ id: c.id, name: c.name }));
  console.error(near.length ? `Near matches: ${JSON.stringify(near)}` : "Candidates: (none)");
  process.exit(1);
}
if (hamdanMatches.length > 1) {
  console.error("ERROR: Multiple Hamdan clients found. Stopping. Candidates:");
  console.error(
    JSON.stringify(
      hamdanMatches.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })),
      null,
      2,
    ),
  );
  process.exit(1);
}
const client = hamdanMatches[0];
console.log(`Using client ${client.name} (${client.id})`);

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
const cartLines = [];
const shortages = [];

for (const item of activeLines) {
  const sku = displaySku(item.sku);
  const skuKey = normSku(sku);
  const hit = liveBySku.get(skuKey);
  let partId;
  let unitCost = 0;
  let onHand = 0;

  if (hit?.kind === "custom") {
    const idx = inventory.customParts.findIndex((p) => p.id === hit.id);
    const current = inventory.customParts[idx];
    const patch = { ...current };
    if (displaySku(patch.partNumber) !== sku) {
      const nums = Array.isArray(patch.partNumbers) ? [...patch.partNumbers] : [patch.partNumber];
      if (!nums.some((n) => displaySku(n) === sku)) nums.unshift(sku);
      patch.partNumbers = nums;
      if (isBlank(patch.partNumber)) patch.partNumber = sku;
    } else {
      patch.partNumber = sku;
    }
    if (isIncompleteText(patch.name, sku)) patch.name = item.name;
    if (isIncompleteText(patch.description, sku)) patch.description = item.description;
    if (isBlank(patch.category)) patch.category = item.category;
    if (!(Number(patch.price) > 0)) patch.price = roundMoney(item.unitPrice);
    inventory.customParts[idx] = patch;
    partId = patch.id;
    unitCost = Number(patch.cost) > 0 ? Number(patch.cost) : 0;
    onHand = Math.max(0, Math.round(Number(patch.quantity) || 0));
    reused.push({
      sku,
      id: partId,
      action: "reused-custom",
      onHand,
      price: patch.price,
      cost: patch.cost,
    });
  } else if (hit?.kind === "catalog" || catalogBySku.has(skuKey)) {
    const catalog = catalogBySku.get(skuKey) || null;
    const id = hit?.id || catalog.id;
    const prevOv = inventory.overrides[id] ?? {};
    const effective = effectivePart(catalog, prevOv);
    const nextOv = { ...prevOv };
    if (catalog && displaySku(catalog.partNumber) !== sku) {
      const nums = Array.isArray(nextOv.partNumbers)
        ? [...nextOv.partNumbers]
        : [...(catalog.partNumbers ?? [catalog.partNumber])];
      if (!nums.some((n) => displaySku(n) === sku)) nums.unshift(sku);
      nextOv.partNumbers = nums;
      nextOv.partNumber = sku;
    }
    if (isIncompleteText(effective.name, sku)) nextOv.name = item.name;
    if (isIncompleteText(effective.description, sku)) nextOv.description = item.description;
    if (isBlank(effective.category)) nextOv.category = item.category;
    if (!(Number(effective.price) > 0)) nextOv.price = roundMoney(item.unitPrice);
    inventory.overrides[id] = nextOv;
    partId = id;
    unitCost = Number(effective.cost) > 0 ? Number(effective.cost) : 0;
    onHand = Math.max(0, Math.round(Number(effective.quantity) || 0));
    reused.push({
      sku,
      id: partId,
      action: "reused-catalog",
      onHand,
      price: nextOv.price ?? effective.price,
      cost: effective.cost,
    });
  } else {
    const part = {
      id: newId("part"),
      partNumber: sku,
      partNumbers: [sku],
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: 0,
      reorderAt: 0,
      cost: 0,
      price: roundMoney(item.unitPrice),
      compatibility: [],
      notes: `Created from Hamdan handwritten order · ${ORDER_MARKER}`,
    };
    inventory.customParts.push(part);
    liveBySku.set(skuKey, { kind: "custom", id: part.id });
    partId = part.id;
    unitCost = 0;
    onHand = 0;
    created.push({
      sku,
      id: partId,
      action: "created",
      onHand,
      price: part.price,
      cost: part.cost,
    });
  }

  if (onHand < item.quantity) shortages.push({ sku, need: item.quantity, have: onHand });

  const reasonBits = [];
  if (item.requiresConfirmation) reasonBits.push(item.confirmationNote || QTY_WARNING);
  if (item.requiresDescriptionConfirmation) {
    reasonBits.push("Description requires confirmation from handwritten order");
  }

  cartLines.push({
    partId,
    partNumber: sku,
    name: item.name,
    category: item.category,
    unitPrice: roundMoney(item.unitPrice),
    unitCost,
    qty: item.quantity,
    ...(reasonBits.length ? { priceOverrideReason: reasonBits.join(" · ") } : {}),
  });
}

const subtotal = centsToMoney(subtotalCents);
const tax = 0;
const discount = 0;
const shipping = 0;
const total = roundMoney(subtotal - discount + tax + shipping);

const internalNote = [
  ORDER_MARKER,
  "DRAFT — do not finalize without confirming part 643331600 quantity.",
  QTY_WARNING,
  "Handwritten grand total $10,973 does not match detailed lines $12,323.40.",
  "Excluded crossed-out SKUs: A0022505115, A0022507215.",
  "Stock not deducted. Deduct only when converting Draft → Unpaid invoice in the app.",
  shortages.length
    ? `Stock shortages at draft time: ${shortages
        .map((s) => `${s.sku} need ${s.need} have ${s.have}`)
        .join("; ")}`
    : "No stock shortages vs on-hand at draft time.",
].join("\n");

const now = new Date();
const existingIdx = documents.findIndex(
  (d) =>
    d?.kind === "quotation" &&
    String(d.internalNote ?? "").includes(ORDER_MARKER) &&
    String(d.partyId ?? "") === client.id,
);

const docBase = {
  kind: "quotation",
  partyKind: "client",
  partyId: client.id,
  partyName: client.name,
  date: now.toISOString().slice(0, 10),
  createdAt: now.toISOString(),
  total,
  status: "Draft",
  lines: cartLines,
  stockDeducted: false,
  amountPaid: 0,
  internalNote,
  customerNote: CUSTOMER_NOTE,
};

let doc;
if (existingIdx >= 0) {
  const prev = documents[existingIdx];
  doc = { ...prev, ...docBase, id: prev.id, createdAt: prev.createdAt || docBase.createdAt };
  documents[existingIdx] = doc;
  console.log(`Refreshing existing draft quotation ${doc.id} (idempotent)`);
} else {
  doc = { id: generateDocId("quotation", now), ...docBase };
  documents.unshift(doc);
  console.log(`Creating draft quotation ${doc.id}`);
}

console.log(
  JSON.stringify(
    {
      dryRun: DRY_RUN,
      client: { id: client.id, name: client.name },
      document: {
        id: doc.id,
        kind: doc.kind,
        status: doc.status,
        date: doc.date,
        subtotal,
        tax,
        discount,
        shipping,
        total,
        lineCount: cartLines.length,
        stockDeducted: doc.stockDeducted,
      },
      warning: QTY_WARNING,
      created,
      reused,
      shortages,
    },
    null,
    2,
  ),
);

await saveKey(sb, "inventory", inventory);
await saveKey(sb, "documents", documents);

console.log(
  DRY_RUN
    ? "Dry-run complete — no writes."
    : `Saved inventory + draft quotation ${doc.id} for ${client.name}.`,
);
