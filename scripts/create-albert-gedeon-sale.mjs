/**
 * Record a paid + picked-up cash sale for Albert Gedeon.
 *
 * Lines:
 *   HPV116 pilot pump  $350.00 × 1
 * Total $350.00 — Cash paid, fulfillment Picked up.
 * Note: he sold it for $400.
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-albert-gedeon-sale.mjs --yes
 *   node --env-file=.env.local scripts/create-albert-gedeon-sale.mjs --yes --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

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

const ORDER_MARKER = "albert-gedeon-hpv116-pilot-pump-sale-v1";
const CLIENT_NAME = "Albert Gedeon";
const SALE_DATE = "2026-09-25";
const CUSTOMER_NOTE = `He sold it for $400 · Paid cash · picked up · ${ORDER_MARKER}`;

const LINES = [
  {
    partNumber: "HPV116",
    name: "HPV116 pilot pump",
    category: "Hydraulics",
    qty: 1,
    unitPrice: 350,
  },
];

const sb = createClient(url, key, { auth: { persistSession: false } });

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function mintId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function docId(kind, date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const prefix = kind === "invoice" ? "INV" : kind === "receipt" ? "RCP" : "DOC";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${y}${m}${d}-${hh}${mm}${ss}${ms}-${rand}`;
}

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function loadState(key) {
  const { data, error } = await sb
    .from("shop_state")
    .select("value, updated_at")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return { value: data?.value ?? null, updatedAt: data?.updated_at ?? null };
}

async function saveState(key, value) {
  if (DRY_RUN) {
    console.log(`[dry-run] skip save ${key}`);
    return;
  }
  const updatedAt = new Date().toISOString();
  const { error } = await sb
    .from("shop_state")
    .update({ value, updated_at: updatedAt })
    .eq("key", key);
  if (error) throw error;
}

function findCustomPart(customParts, line) {
  const wantPn = norm(line.partNumber);
  const wantName = norm(line.name);
  return (
    customParts.find((p) => norm(p.partNumber) === wantPn && norm(p.name) === wantName) ||
    customParts.find((p) => norm(p.name) === wantName) ||
    customParts.find(
      (p) =>
        norm(p.partNumber) === wantPn &&
        norm(p.name).includes("pilot") &&
        norm(p.name).includes("pump"),
    )
  );
}

async function main() {
  const partiesRow = await loadState("parties");
  const inventoryRow = await loadState("inventory");
  const documentsRow = await loadState("documents");

  const parties = partiesRow.value || { clients: [], suppliers: [] };
  const clients = parties.clients || [];
  const inventory = inventoryRow.value || {
    overrides: {},
    customParts: [],
    customCategories: [],
  };
  const customParts = [...(inventory.customParts || [])];
  let documents = documentsRow.value;
  if (!Array.isArray(documents)) {
    documents = documents?.documents || [];
  }

  const existing = documents.find(
    (d) =>
      d.kind === "invoice" &&
      (d.internalNote === ORDER_MARKER ||
        String(d.customerNote || "").includes(ORDER_MARKER)),
  );
  if (existing) {
    console.log(
      "Already exists:",
      existing.id,
      "total",
      existing.total,
      "status",
      existing.status,
      existing.fulfillmentStatus,
    );
    process.exit(0);
  }

  let client =
    clients.find((c) => norm(c.name) === norm(CLIENT_NAME)) ||
    clients.find(
      (c) => norm(c.name).includes("albert") && norm(c.name).includes("gedeon"),
    );
  if (!client) {
    client = {
      id: mintId("cli"),
      name: CLIENT_NAME,
      email: "",
      phone: "",
      address: "",
      contactName: "",
    };
    clients.push(client);
    parties.clients = clients;
    console.log("Created client", client.id, client.name);
  } else {
    console.log("Using client", client.id, client.name);
  }

  const resolvedLines = [];
  for (const line of LINES) {
    let part = findCustomPart(customParts, line);
    if (!part) {
      part = {
        id: mintId("part"),
        cost: 0,
        name: line.name,
        price: line.unitPrice,
        category: line.category,
        quantity: 0,
        reorderAt: 0,
        partNumber: line.partNumber,
        partNumbers: [line.partNumber],
        compatibility: [],
      };
      customParts.push(part);
      console.log("Created part", part.partNumber, part.id);
    } else {
      if (!part.price || Number(part.price) <= 0) part.price = line.unitPrice;
      console.log("Using part", part.partNumber, part.id, "qty", part.quantity);
    }

    const before = Math.max(0, Math.round(Number(part.quantity) || 0));
    part.quantity = Math.max(0, before - line.qty);

    resolvedLines.push({
      qty: line.qty,
      name: part.name,
      partId: part.id,
      category: part.category || line.category,
      unitCost: Number(part.cost) || 0,
      unitPrice: line.unitPrice,
      partNumber: part.partNumber,
      fulfillmentStatus: "Picked up",
    });
  }

  const total = roundMoney(
    resolvedLines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
  );
  const createdAt = new Date(`${SALE_DATE}T10:25:00.000Z`);
  const invoiceId = docId("invoice", createdAt);
  const receiptAt = new Date(createdAt.getTime() + 1000);
  const receiptId = docId("receipt", receiptAt);
  const batchId = randomUUID();

  const invoice = {
    id: invoiceId,
    kind: "invoice",
    partyKind: "client",
    partyId: client.id,
    partyName: client.name,
    date: SALE_DATE,
    createdAt: createdAt.toISOString(),
    total,
    status: "Paid",
    amountPaid: total,
    lines: resolvedLines,
    stockDeducted: true,
    fulfillmentStatus: "Picked up",
    internalNote: ORDER_MARKER,
    customerNote: CUSTOMER_NOTE,
  };

  const receipt = {
    id: receiptId,
    kind: "receipt",
    partyKind: "client",
    partyId: client.id,
    partyName: client.name,
    date: SALE_DATE,
    createdAt: receiptAt.toISOString(),
    total,
    status: "Paid",
    invoiceId,
    paymentDate: SALE_DATE,
    paymentMethod: "Cash",
    affectsBalance: true,
    invoiceTotal: total,
    amountPaidAfter: total,
    invoiceRemainingAfter: 0,
    paymentBatchId: batchId,
    clientRequestId: batchId,
    lines: [
      {
        qty: 1,
        name: `Payment toward ${invoiceId} · Cash`,
        partId: `pay-${invoiceId}`,
        category: "Payment",
        unitCost: 0,
        unitPrice: total,
        partNumber: invoiceId,
      },
    ],
  };

  console.log("Invoice", invoiceId, "total", total);
  for (const l of resolvedLines) {
    console.log(
      `  ${l.partNumber} × ${l.qty} @ $${l.unitPrice} = $${roundMoney(l.qty * l.unitPrice)}`,
    );
  }
  console.log("Note:", CUSTOMER_NOTE);
  console.log("Receipt", receiptId);

  inventory.customParts = customParts;
  documents = [...documents, invoice, receipt];

  await saveState("parties", parties);
  await saveState("inventory", inventory);
  await saveState("documents", documents);

  console.log(DRY_RUN ? "Dry-run complete." : "Saved parties, inventory, documents.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
