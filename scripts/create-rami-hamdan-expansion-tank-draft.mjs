/**
 * Create/reuse client "Rami Hamdan" and upsert expansion-tank Draft quotation.
 *
 * - Exact normalized client match only (trim + case-insensitive).
 * - Never confuse with "Rida Hamdan" / bare "Hamdan".
 * - Create client only when missing; leave phone/email/address empty.
 * - Upsert SKUs by exact OEM number; no stock-in; no cost overwrite.
 * - Draft quotation, stockDeducted=false; stock deducted only on convert in UI.
 * - Idempotent via ORDER_MARKER.
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-rami-hamdan-expansion-tank-draft.mjs --yes
 *   node --env-file=.env.local scripts/create-rami-hamdan-expansion-tank-draft.mjs --yes --dry-run
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

const CLIENT_NAME = "Rami Hamdan";
const ORDER_MARKER = "rami-hamdan-expansion-tank-order-v1";
const EXPECTED_SUBTOTAL_CENTS = 53345; // $533.45
const EXPECTED_LINE_COUNT = 13;
const CUSTOMER_NOTE =
  "Expansion tank order. All products supplied without caps and packed in neutral brown boxes.";

const ORDER_LINES = [
  {
    "sku": "17137787040",
    "oemNumber": "17137787040",
    "name": "BMW E46 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for BMW E46 four-cylinder models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "BMW",
    "applicableModels": "E46 (4-cylinder)",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 7.63,
    "lineTotal": 38.15
  },
  {
    "sku": "17137787039",
    "oemNumber": "17137787039",
    "name": "BMW E53 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for BMW E53 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "BMW",
    "applicableModels": "E53",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 7.63,
    "lineTotal": 38.15
  },
  {
    "sku": "17138621092",
    "oemNumber": "17138621092",
    "name": "BMW E70 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for BMW E70 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "BMW",
    "applicableModels": "E70",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 9.39,
    "lineTotal": 46.95
  },
  {
    "sku": "17138614293",
    "oemNumber": "17138614293",
    "name": "BMW F10 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for BMW F10 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "BMW",
    "applicableModels": "F10",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 6.90,
    "lineTotal": 34.50
  },
  {
    "sku": "17137640514",
    "oemNumber": "17137640514",
    "name": "BMW F20 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for BMW F20 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "BMW",
    "applicableModels": "F20",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 9.39,
    "lineTotal": 46.95
  },
  {
    "sku": "17138677649",
    "oemNumber": "17138677649",
    "name": "BMW F30 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for BMW F30 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "BMW",
    "applicableModels": "F30",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 12.77,
    "lineTotal": 63.85
  },
  {
    "sku": "2035000049",
    "oemNumber": "2035000049",
    "name": "Mercedes-Benz W203 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for Mercedes-Benz W203 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "Mercedes-Benz",
    "applicableModels": "W203",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 7.63,
    "lineTotal": 38.15
  },
  {
    "sku": "2045000649",
    "oemNumber": "2045000649",
    "name": "Mercedes-Benz W204 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for Mercedes-Benz W204 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "Mercedes-Benz",
    "applicableModels": "W204",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 9.10,
    "lineTotal": 45.50
  },
  {
    "sku": "2115000049",
    "oemNumber": "2115000049",
    "name": "Mercedes-Benz W211 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for Mercedes-Benz W211 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "Mercedes-Benz",
    "applicableModels": "W211",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 6.90,
    "lineTotal": 34.50
  },
  {
    "sku": "2215000349",
    "oemNumber": "2215000349",
    "name": "Mercedes-Benz W221 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for Mercedes-Benz W221 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "Mercedes-Benz",
    "applicableModels": "W221",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 7.63,
    "lineTotal": 38.15
  },
  {
    "sku": "LR020367",
    "oemNumber": "LR020367",
    "name": "Land Rover LR3/LR4 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for Land Rover LR3 and LR4 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "Land Rover",
    "applicableModels": "LR3 / LR4",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 7.19,
    "lineTotal": 35.95
  },
  {
    "sku": "LR024296",
    "oemNumber": "LR024296",
    "name": "Land Rover LR2 Expansion Tank",
    "description": "Engine coolant expansion tank without cap for Land Rover LR2 models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "Land Rover",
    "applicableModels": "LR2",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 5.43,
    "lineTotal": 27.15
  },
  {
    "sku": "LR023080",
    "oemNumber": "LR023080",
    "name": "Range Rover Vogue Expansion Tank",
    "description": "Engine coolant expansion tank without cap for Range Rover Vogue models",
    "category": "Cooling System / Expansion Tanks",
    "brandApplication": "Land Rover / Range Rover",
    "applicableModels": "Range Rover Vogue",
    "parameter": "Without cap",
    "packaging": "Neutral brown box",
    "quantity": 5,
    "unitPrice": 9.10,
    "lineTotal": 45.50
  }
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
  if (items.length !== EXPECTED_LINE_COUNT) {
    discrepancies.push({
      reason: `Expected ${EXPECTED_LINE_COUNT} lines, got ${items.length}`,
    });
  }
  for (const item of items) {
    if (item.quantity !== 5) {
      discrepancies.push({ sku: item.sku, reason: `Expected qty 5, got ${item.quantity}` });
    }
    const sku = displaySku(item.sku);
    const oem = displaySku(item.oemNumber ?? item.sku);
    if (sku !== oem) {
      discrepancies.push({ sku, reason: `SKU/OEM mismatch: sku=${sku} oem=${oem}` });
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

const { discrepancies, subtotalCents } = validateLines(ORDER_LINES);
if (discrepancies.length) {
  console.error("ABORT: validation discrepancies:");
  console.error(JSON.stringify(discrepancies, null, 2));
  process.exit(1);
}
if (subtotalCents !== EXPECTED_SUBTOTAL_CENTS) {
  console.error(
    `ABORT: subtotal $${centsToMoney(subtotalCents)} !== expected $${centsToMoney(EXPECTED_SUBTOTAL_CENTS)}`,
  );
  process.exit(1);
}

console.log(
  `Validated ${ORDER_LINES.length} lines · all qty=5 · subtotal $${centsToMoney(subtotalCents)}`,
);

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

const clientKey = CLIENT_NAME.trim().toLowerCase();
const clientMatches = parties.clients.filter(
  (c) => String(c.name ?? "").trim().toLowerCase() === clientKey,
);
if (clientMatches.length > 1) {
  console.error(`ERROR: Multiple clients match "${CLIENT_NAME}". Stopping.`);
  console.error(
    JSON.stringify(
      clientMatches.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })),
      null,
      2,
    ),
  );
  process.exit(1);
}

let clientCreated = false;
let client;
if (clientMatches.length === 1) {
  client = clientMatches[0];
  console.log(`Reusing client ${client.name} (${client.id})`);
} else {
  // Do not confuse with Rida Hamdan / bare Hamdan — exact match only.
  const near = parties.clients
    .filter((c) => String(c.name ?? "").toLowerCase().includes("hamdan"))
    .map((c) => ({ id: c.id, name: c.name }));
  console.log(
    `No exact "${CLIENT_NAME}" found. Near Hamdan clients (not used): ${JSON.stringify(near)}`,
  );
  client = {
    id: newId("cli"),
    name: CLIENT_NAME,
    contactName: "",
    email: "",
    phone: "",
    address: "",
  };
  parties.clients.unshift(client);
  clientCreated = true;
  console.log(`Creating client ${client.name} (${client.id})`);
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
const cartLines = [];
const shortages = [];

for (const item of ORDER_LINES) {
  const sku = displaySku(item.sku);
  const skuKey = normSku(sku);
  const hit = liveBySku.get(skuKey);
  let partId;
  let unitCost = 0;
  let onHand = 0;

  const notesExtra = [
    item.brandApplication ? `Brand: ${item.brandApplication}` : null,
    item.applicableModels ? `Models: ${item.applicableModels}` : null,
    item.parameter ? `Param: ${item.parameter}` : null,
    item.packaging ? `Packaging: ${item.packaging}` : null,
    `OEM: ${displaySku(item.oemNumber || sku)}`,
    ORDER_MARKER,
  ]
    .filter(Boolean)
    .join(" · ");

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
    if (isBlank(patch.notes)) patch.notes = notesExtra;
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
    if (isBlank(effective.notes) && isBlank(nextOv.notes)) nextOv.notes = notesExtra;
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
      compatibility: item.applicableModels ? [item.applicableModels] : [],
      notes: notesExtra,
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

  // Snapshot line fields for historical invoice integrity.
  cartLines.push({
    partId,
    partNumber: sku,
    name: item.name,
    category: item.category,
    unitPrice: roundMoney(item.unitPrice),
    unitCost,
    qty: item.quantity,
    descriptionSnapshot: item.description,
  });
}

const subtotal = centsToMoney(subtotalCents);
const tax = 0;
const discount = 0;
const shipping = 0;
const total = roundMoney(subtotal - discount + tax + shipping);

const internalNote = [
  ORDER_MARKER,
  "DRAFT expansion-tank order for Rami Hamdan — separate from Rida Hamdan order.",
  CUSTOMER_NOTE,
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

const summary = {
  dryRun: DRY_RUN,
  clientCreated,
  client: {
    id: client.id,
    name: client.name,
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
  },
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
    customerNote: doc.customerNote,
  },
  lines: cartLines.map((l) => ({
    sku: l.partNumber,
    name: l.name,
    description: l.descriptionSnapshot,
    qty: l.qty,
    unitPrice: l.unitPrice,
    lineTotal: roundMoney(l.qty * l.unitPrice),
  })),
  created,
  reused,
  shortages,
};

console.log(JSON.stringify(summary, null, 2));

await saveKey(sb, "parties", parties);
await saveKey(sb, "inventory", inventory);
await saveKey(sb, "documents", documents);

console.log(
  DRY_RUN
    ? "Dry-run complete — no writes."
    : `Saved client + inventory + draft quotation ${doc.id} for ${client.name}.`,
);
