/**
 * Import an Arabic quotation Excel into live shop_state
 * (parties + inventory custom parts + documents quotation).
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-quotation-xlsx.mjs --yes --file "C:/path/to.xlsx"
 *   node --env-file=.env.local scripts/import-quotation-xlsx.mjs --yes --file "..." --client divers
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

if (!process.argv.includes("--yes")) {
  console.error("Refusing to write shop_state. Re-run with --yes after reviewing.");
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key).");
  process.exit(1);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const filePath = argValue("--file");
const clientOverride = argValue("--client");
if (!filePath || !fs.existsSync(filePath)) {
  console.error("Pass an existing --file path to the .xlsx");
  process.exit(1);
}

const DEFAULT_CLIENT = "divers";
const sb = createClient(url, key);

function cellStr(v) {
  if (v == null) return "";
  return String(v).replace(/\u00a0/g, " ").trim();
}

function cellNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateQuoteId(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return `Q-${y}${m}${d}-${hh}${mm}${ss}${ms}-${rand}`;
}

function looksLikeHeader(row) {
  const joined = row.map(cellStr).join(" ").toLowerCase();
  let hits = 0;
  for (const m of ["النوع", "رقم القطعة", "العدد", "سعر الوحدة", "type", "qty", "price"]) {
    if (joined.includes(m.toLowerCase())) hits += 1;
  }
  return hits >= 2;
}

function isTotalRow(row) {
  const joined = row.map(cellStr).join(" ").toLowerCase();
  return (
    joined.includes("الإجمالي") ||
    joined.includes("الاجمالي") ||
    joined.includes("المجموع الكلي") ||
    /\btotal\b/.test(joined)
  );
}

function parseQuotation(buf, fileName) {
  const book = XLSX.read(buf, { type: "buffer" });
  const sheetName = book.SheetNames[0];
  const sheet = book.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (looksLikeHeader(rows[i] ?? [])) {
      headerIdx = i;
      break;
    }
  }

  const lines = [];
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

  return {
    sheetName,
    fileName,
    lines,
    subtotal: roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0)),
  };
}

async function loadKey(keyName, fallback) {
  const { data, error } = await sb.from("shop_state").select("value, updated_at").eq("key", keyName).maybeSingle();
  if (error) throw error;
  return {
    value: data?.value ?? fallback,
    updatedAt: data?.updated_at ?? null,
  };
}

async function saveKey(keyName, value, expectedUpdatedAt) {
  const payload = {
    key: keyName,
    value,
    updated_at: new Date().toISOString(),
  };
  // Always upsert; revision conflict is rare for one-shot admin scripts
  const { error } = await sb.from("shop_state").upsert(payload);
  if (error) throw error;
  void expectedUpdatedAt;
}

function indexPartNumbers(customParts) {
  const map = new Map();
  for (const p of customParts ?? []) {
    const nums = [
      p.partNumber,
      ...((p.partNumbers ?? []).filter(Boolean)),
    ];
    for (const n of nums) {
      map.set(String(n).trim().toLowerCase(), p);
    }
  }
  return map;
}

const preview = parseQuotation(fs.readFileSync(filePath), path.basename(filePath));
const clientName = (clientOverride || DEFAULT_CLIENT).trim() || DEFAULT_CLIENT;

console.log(
  `Parsed ${preview.lines.length} lines · ${preview.subtotal} USD · client=${clientName} · ${preview.fileName}`,
);

const [invRow, partiesRow, docsRow] = await Promise.all([
  loadKey("inventory", { overrides: {}, customParts: [], customCategories: [] }),
  loadKey("parties", { clients: [], suppliers: [] }),
  loadKey("documents", []),
]);

const inventory = {
  overrides: invRow.value?.overrides ?? {},
  customParts: [...(invRow.value?.customParts ?? [])],
  customCategories: [...(invRow.value?.customCategories ?? [])],
};
const parties = {
  clients: [...(partiesRow.value?.clients ?? [])],
  suppliers: [...(partiesRow.value?.suppliers ?? [])],
};
const documents = Array.isArray(docsRow.value) ? [...docsRow.value] : [];

let client = parties.clients.find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase());
if (!client) {
  client = {
    id: newId("cli"),
    name: clientName,
    contactName: "",
    email: "",
    phone: "",
    address: "",
    notes: "Created from quotation Excel import",
  };
  parties.clients.push(client);
  console.log(`Created client ${client.name} (${client.id})`);
} else {
  console.log(`Using client ${client.name} (${client.id})`);
}

const byNumber = indexPartNumbers(inventory.customParts);
const cartLines = [];
let createdParts = 0;
let matchedParts = 0;

for (const line of preview.lines) {
  const key = line.partNumber.trim().toLowerCase();
  let part = byNumber.get(key);
  if (part) {
    matchedParts += 1;
    if (line.unitPrice > 0 && part.price !== line.unitPrice) {
      part = { ...part, price: line.unitPrice };
      const idx = inventory.customParts.findIndex((p) => p.id === part.id);
      if (idx >= 0) inventory.customParts[idx] = part;
      byNumber.set(key, part);
    }
  } else {
    part = {
      id: newId("part"),
      partNumber: line.partNumber,
      partNumbers: [line.partNumber],
      name: line.name,
      category: "MISC",
      quantity: 0,
      reorderAt: 0,
      cost: 0,
      price: line.unitPrice,
      compatibility: [],
      notes: `Created from quotation Excel · ${preview.fileName}`,
    };
    inventory.customParts.push(part);
    byNumber.set(key, part);
    createdParts += 1;
  }

  cartLines.push({
    partId: part.id,
    partNumber: part.partNumber,
    name: part.name || line.name,
    category: part.category,
    unitPrice: line.unitPrice,
    unitCost: part.cost ?? 0,
    qty: line.qty,
  });
}

const createdAt = new Date();
const total = roundMoney(cartLines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
const quotation = {
  id: generateQuoteId(createdAt),
  kind: "quotation",
  partyKind: "client",
  partyId: client.id,
  partyName: client.name,
  date: createdAt.toISOString().slice(0, 10),
  createdAt: createdAt.toISOString(),
  total,
  status: "Sent",
  lines: cartLines,
  internalNote: `Imported from Excel · ${preview.fileName}`,
};

documents.unshift(quotation);

await saveKey("parties", parties, partiesRow.updatedAt);
await saveKey("inventory", inventory, invRow.updatedAt);
await saveKey("documents", documents, docsRow.updatedAt);

console.log(
  `Saved quotation ${quotation.id} · ${cartLines.length} lines · ${createdParts} new · ${matchedParts} matched · $${total}`,
);
