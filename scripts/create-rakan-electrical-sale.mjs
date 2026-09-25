/**
 * Rakan electrical — plugs ×2 @ $5 + Komatsu red sensors ×2 @ $13.50 = $37.
 * Paid & picked up.
 * Usage: node --env-file=.env.local scripts/create-rakan-electrical-sale.mjs --yes
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
  console.error("Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key).");
  process.exit(1);
}

const ORDER_MARKER = "rakan-electrical-plugs-sensors-sale-v1";
const CLIENT_NAME = "Rakan electrical";
const SALE_DATE = "2026-09-25";
const LINES = [
  { partNumber: "PLUG", name: "Plug", category: "Electrical", qty: 2, unitPrice: 5 },
  { partNumber: "KOMATSU-RED-SENSOR", name: "Komatsu red sensor", category: "Sensors", qty: 2, unitPrice: 13.5 },
];

const sb = createClient(url, key, { auth: { persistSession: false } });
const norm = (s) => String(s || "").trim().toLowerCase();
const roundMoney = (n) => Math.round(Number(n) * 100) / 100;
const mintId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function docId(kind, date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const prefix = kind === "invoice" ? "INV" : "RCP";
  const t = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}${String(date.getMilliseconds()).padStart(3, "0")}`;
  return `${prefix}-${y}${m}${d}-${t}-${Math.random().toString(36).slice(2, 6)}`;
}

async function loadState(key) {
  const { data, error } = await sb.from("shop_state").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function saveState(key, value) {
  if (DRY_RUN) return;
  const { error } = await sb
    .from("shop_state")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}

async function main() {
  const parties = (await loadState("parties")) || { clients: [] };
  const inventory = (await loadState("inventory")) || { customParts: [] };
  let documents = await loadState("documents");
  if (!Array.isArray(documents)) documents = documents?.documents || [];

  if (
    documents.some(
      (d) =>
        d.kind === "invoice" &&
        (d.internalNote === ORDER_MARKER || String(d.customerNote || "").includes(ORDER_MARKER)),
    )
  ) {
    console.log("Already exists", ORDER_MARKER);
    process.exit(0);
  }

  const clients = parties.clients || [];
  let client =
    clients.find((c) => norm(c.name) === norm(CLIENT_NAME)) ||
    clients.find((c) => norm(c.name).includes("rakan") && norm(c.name).includes("electric"));
  if (!client) {
    client = { id: mintId("cli"), name: CLIENT_NAME, email: "", phone: "", address: "", contactName: "" };
    clients.push(client);
    parties.clients = clients;
  }

  const customParts = [...(inventory.customParts || [])];
  const resolved = [];
  for (const line of LINES) {
    let part =
      customParts.find((p) => norm(p.partNumber) === norm(line.partNumber)) ||
      customParts.find((p) => norm(p.name) === norm(line.name));
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
    }
    part.quantity = Math.max(0, Math.round(Number(part.quantity) || 0) - line.qty);
    resolved.push({
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

  const total = roundMoney(resolved.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const createdAt = new Date(`${SALE_DATE}T11:20:00.000Z`);
  const invoiceId = docId("invoice", createdAt);
  const receiptAt = new Date(createdAt.getTime() + 1000);
  const receiptId = docId("receipt", receiptAt);
  const batchId = randomUUID();

  documents.push({
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
    lines: resolved,
    stockDeducted: true,
    fulfillmentStatus: "Picked up",
    internalNote: ORDER_MARKER,
    customerNote: `Paid cash · picked up · ${ORDER_MARKER}`,
  });
  documents.push({
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
  });

  inventory.customParts = customParts;
  await saveState("parties", parties);
  await saveState("inventory", inventory);
  await saveState("documents", documents);
  console.log("Invoice", invoiceId, "total", total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
