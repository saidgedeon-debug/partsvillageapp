/**
 * Receive Jul 22 order into cloud inventory.
 * Part code and size are stored separately (code ≠ dimensions).
 * Prices on the sheet are RMB; convert with RATE → USD.
 */
import { createClient } from "@supabase/supabase-js";

const RATE = 0.1477;
const rmbToUsd = (rmb) => Math.round(rmb * RATE * 100) / 100;

/** Catalog rows matched from the order (qty added on top of current stock). */
const catalogReceives = [
  {
    id: "oring-0320",
    partNumber: "AS568-244",
    aliases: ["AS244"],
    qtyAdd: 200,
    rmb: 1.97,
    insideDiameterMm: "107.54",
    crossSectionMm: "3.53",
    note: "AS244 · order received · RMB→USD",
  },
  {
    id: "oring-0119",
    partNumber: "AS568-130",
    aliases: ["AS130"],
    qtyAdd: 200,
    rmb: 0.38,
    insideDiameterMm: "40.95",
    crossSectionMm: "2.62",
    note: "AS130 · order received · RMB→USD",
  },
  {
    id: "oring-0220",
    partNumber: "AS568-128",
    aliases: ["AS222"],
    qtyAdd: 200,
    rmb: 0.48,
    insideDiameterMm: "37.7",
    crossSectionMm: "3.53",
    note: "Customer AS222 · order received · RMB→USD",
  },
];

/** New / custom seals — code only; size in ID / CS (and OD in notes when needed). */
const customParts = [
  {
    id: "order-roi-90-5-101-4-9",
    partNumber: "ROI",
    partNumbers: ["ROI"],
    name: "O-Ring ROI",
    category: "O-Rings",
    quantity: 20,
    reorderAt: 5,
    cost: rmbToUsd(4.8),
    price: rmbToUsd(4.8),
    compatibility: [],
    insideDiameterMm: "90.5",
    crossSectionMm: "4.9",
    notes: `OD 101 · size 90.5×101×4.9 · order RMB 4.80 → USD @ ${RATE}`,
  },
  {
    id: "order-g26-26-5-3",
    partNumber: "G26",
    partNumbers: ["G26"],
    name: "26.5 x 3",
    category: "O-Rings",
    quantity: 200,
    reorderAt: 20,
    cost: 0,
    price: 0,
    compatibility: [],
    insideDiameterMm: "26.5",
    crossSectionMm: "3",
    notes: "Size 26.5 x 3 · order received (price TBD)",
  },
  {
    id: "order-as276-279-353",
    partNumber: "AS276",
    partNumbers: ["AS276", "AS568-276"],
    name: "O-Ring AS276",
    category: "O-Rings",
    quantity: 200,
    reorderAt: 20,
    cost: rmbToUsd(5.55),
    price: rmbToUsd(5.55),
    compatibility: [],
    insideDiameterMm: "279",
    crossSectionMm: "3.53",
    notes: `Size 279×3.53 · order RMB 5.55 → USD @ ${RATE}`,
  },
  {
    id: "order-dsga-90-100-5",
    partNumber: "DSGA",
    partNumbers: ["DSGA"],
    name: "Seal DSGA",
    category: "O-Rings",
    quantity: 0,
    reorderAt: 0,
    cost: 0,
    price: 0,
    compatibility: [],
    insideDiameterMm: "90",
    crossSectionMm: "5",
    notes: "OD 100 · size 90×100×5 · on order sheet (qty/price TBD)",
  },
];

const url = process.env.VITE_SUPABASE_URL || "https://swzxiarvjqckzejznjwx.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!key) {
  console.error("No Supabase key");
  process.exit(1);
}

const sb = createClient(url, key);
const { data, error } = await sb.from("shop_state").select("value").eq("key", "inventory").maybeSingle();
if (error) throw error;

const store = data?.value ?? { overrides: {}, customParts: [], customCategories: [] };
const overrides = { ...(store.overrides ?? {}) };

// Catalog base qtys (from source) used when no qty override yet
const catalogBaseQty = {
  "oring-0320": 200,
  "oring-0119": 500,
  "oring-0220": 50,
};

for (const u of catalogReceives) {
  const usd = rmbToUsd(u.rmb);
  const prev = overrides[u.id] ?? {};
  const baseQty =
    typeof prev.quantity === "number" ? prev.quantity : (catalogBaseQty[u.id] ?? 0);
  // Only add once: if we already received this order (notes mark), keep qty; else add
  const already = String(prev.notes ?? "").includes("order received");
  const quantity = already ? baseQty : baseQty + u.qtyAdd;
  overrides[u.id] = {
    ...prev,
    price: usd,
    cost: usd,
    insideDiameterMm: u.insideDiameterMm,
    crossSectionMm: u.crossSectionMm,
    partNumbers: [u.partNumber, ...u.aliases],
    quantity,
    notes: u.note,
  };
  console.log(
    `Catalog ${u.partNumber} (+${u.aliases.join("/")}): qty ${quantity}, size ${u.insideDiameterMm}×${u.crossSectionMm}, $${usd}`,
  );
}

const byId = new Map((store.customParts ?? []).map((p) => [p.id, p]));
// Drop old ROI row that baked size into the code
for (const [id, p] of [...byId.entries()]) {
  if (p.partNumber?.includes("90.5") || p.partNumber === "ROI 90.5x101x4.9") {
    byId.delete(id);
  }
}
for (const p of customParts) {
  byId.set(p.id, { ...(byId.get(p.id) ?? {}), ...p });
  console.log(
    `Custom ${p.partNumber}: qty ${p.quantity}, ID ${p.insideDiameterMm} CS ${p.crossSectionMm}, $${p.price}`,
  );
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

console.log("\nCloud inventory updated — codes and sizes separated, order qty applied.");
