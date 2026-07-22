/**
 * Apply Jul 22 order prices (RMB → USD) to inventory.
 * Rate: 1 CNY = 0.1477 USD (~Jul 2026).
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const RATE = 0.1477;
const rmbToUsd = (rmb) => Math.round(rmb * RATE * 100) / 100;

const updates = [
  // matched catalog ids
  { id: "oring-0320", partNumber: "AS568-244", rmb: 1.97, note: "AS244 · from order RMB→USD" },
  { id: "oring-0119", partNumber: "AS568-130", rmb: 0.38, note: "AS130 · from order RMB→USD" },
  { id: "oring-0220", partNumber: "AS568-128", rmb: 0.48, note: "Customer AS222 37.7×3.53 · RMB→USD" },
];

const customParts = [
  {
    id: "order-roi-90-5-101-4-9",
    partNumber: "ROI 90.5x101x4.9",
    partNumbers: ["ROI 90.5x101x4.9"],
    name: "O-Ring ROI 90.5×101×4.9 mm",
    category: "O-Rings",
    quantity: 0,
    reorderAt: 0,
    cost: rmbToUsd(4.8),
    price: rmbToUsd(4.8),
    compatibility: [],
    insideDiameterMm: "90.5",
    crossSectionMm: "4.9",
    notes: `OD ~101 · Order RMB 4.80 → USD @ ${RATE}`,
  },
  {
    id: "order-as276-279-353",
    partNumber: "AS276",
    partNumbers: ["AS276", "AS568-276"],
    name: "O-Ring AS276 · 279×3.53 mm",
    category: "O-Rings",
    quantity: 0,
    reorderAt: 0,
    cost: rmbToUsd(5.55),
    price: rmbToUsd(5.55),
    compatibility: [],
    insideDiameterMm: "279",
    crossSectionMm: "3.53",
    notes: `Order RMB 5.55 → USD @ ${RATE}`,
  },
  {
    id: "order-dsga-90-100-5",
    partNumber: "DSGA 90x100x5",
    partNumbers: ["DSGA 90x100x5", "DSGA 90*100*5"],
    name: "O-Ring DSGA 90×100×5 mm",
    category: "O-Rings",
    quantity: 0,
    reorderAt: 0,
    cost: 0,
    price: 0,
    compatibility: [],
    insideDiameterMm: "90",
    crossSectionMm: "5",
    notes: "OD ~100 · price TBD on order",
  },
];

// Patch catalog source prices for matched rows
let src = fs.readFileSync("src/lib/orings-inventory.ts", "utf8");
for (const u of updates) {
  const usd = rmbToUsd(u.rmb);
  const blockRe = new RegExp(
    `(id:\\s*"${u.id}"[\\s\\S]*?price:\\s*)([\\d.]+)([\\s\\S]*?notes:\\s*")([^"]*)(")`,
  );
  if (!blockRe.test(src)) {
    console.warn("Could not patch", u.id);
    continue;
  }
  src = src.replace(blockRe, `$1${usd}$3$4${u.note}$5`);
  // also set cost to same USD for now
  const costRe = new RegExp(`(id:\\s*"${u.id}"[\\s\\S]*?cost:\\s*)([\\d.]+)`);
  src = src.replace(costRe, `$1${usd}`);
  console.log(`Catalog ${u.partNumber}: RMB ${u.rmb} → USD ${usd}`);
}
fs.writeFileSync("src/lib/orings-inventory.ts", src);

// Push cloud overrides + custom parts so live app picks them up
const url = process.env.VITE_SUPABASE_URL || "https://swzxiarvjqckzejznjwx.supabase.co";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
if (!key) {
  console.error("No Supabase key");
  process.exit(1);
}

const sb = createClient(url, key);
const { data, error } = await sb.from("shop_state").select("value").eq("key", "inventory").maybeSingle();
if (error) throw error;

const store = data?.value ?? { overrides: {}, customParts: [], customCategories: [] };
const overrides = { ...(store.overrides ?? {}) };
for (const u of updates) {
  const usd = rmbToUsd(u.rmb);
  overrides[u.id] = {
    ...(overrides[u.id] ?? {}),
    price: usd,
    cost: usd,
    notes: u.note,
  };
}

const existingCustom = store.customParts ?? [];
const byId = new Map(existingCustom.map((p) => [p.id, p]));
for (const p of customParts) {
  byId.set(p.id, { ...(byId.get(p.id) ?? {}), ...p });
  console.log(`Custom ${p.partNumber}: price USD ${p.price}`);
}

const next = {
  overrides,
  customParts: [...byId.values()],
  customCategories: store.customCategories ?? [],
};

const { error: upErr } = await sb.from("shop_state").upsert({
  key: "inventory",
  value: next,
  updated_at: new Date().toISOString(),
});
if (upErr) throw upErr;

console.log("\nCloud inventory updated.");
console.log("Order USD totals:");
const lines = [
  ["ROI 90.5x101x4.9", 4.8, 20],
  ["AS244", 1.97, 200],
  ["AS276", 5.55, 200],
  ["AS222→AS568-128", 0.48, 200],
  ["AS130", 0.38, 200],
];
let total = 0;
for (const [label, rmb, qty] of lines) {
  const usd = rmbToUsd(rmb);
  const line = Math.round(usd * qty * 100) / 100;
  total += line;
  console.log(`  ${label}: ${qty} × $${usd.toFixed(2)} = $${line.toFixed(2)}`);
}
console.log(`  TOTAL: $${total.toFixed(2)} (from ¥1772 @ ${RATE})`);
