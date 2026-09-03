/**
 * Dry-run: find inventory override ids that no longer exist in seals/orings seed catalogs.
 *
 * Usage:
 *   node scripts/reconcile-catalog-overrides.cjs
 *   node scripts/reconcile-catalog-overrides.cjs path/to/inventory-snapshot.json
 *
 * Without a JSON path, prints seed id counts and how to pass a shop_state inventory dump:
 *   { "overrides": { "<part-id>": { ... } }, "customParts": [...] }
 *
 * Does not write to Supabase. Orphans are override keys whose id is not in
 * seals-inventory.ts / orings-inventory.ts and not present as a customParts id.
 */
const fs = require("fs");
const path = require("path");

function extractIdsAndPartNumbers(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const ids = new Set();
  const partNumbers = new Set();
  const idRe = /\bid:\s*"([^"]+)"/g;
  const pnRe = /\bpartNumber:\s*"([^"]+)"/g;
  let m;
  while ((m = idRe.exec(text))) ids.add(m[1]);
  while ((m = pnRe.exec(text))) partNumbers.add(m[1]);
  return { ids, partNumbers };
}

function loadSnapshot(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  // Accept either full shop_state row { value: {...} } or the inventory blob itself.
  const store = raw?.value && typeof raw.value === "object" ? raw.value : raw;
  return {
    overrides: store.overrides && typeof store.overrides === "object" ? store.overrides : {},
    customParts: Array.isArray(store.customParts) ? store.customParts : [],
  };
}

function main() {
  const root = process.cwd();
  const seals = extractIdsAndPartNumbers(path.join(root, "src/lib/seals-inventory.ts"));
  const orings = extractIdsAndPartNumbers(path.join(root, "src/lib/orings-inventory.ts"));
  const seedIds = new Set([...seals.ids, ...orings.ids]);
  const seedPartNumbers = new Set([...seals.partNumbers, ...orings.partNumbers]);

  console.log(
    `Seed catalog: ${seals.ids.size} seal ids · ${orings.ids.size} o-ring ids · ${seedPartNumbers.size} partNumbers`,
  );

  const snapshotPath = process.argv[2];
  if (!snapshotPath) {
    console.log(
      "Dry-run only (no overrides file). Pass an inventory JSON snapshot to list orphaned override ids.",
    );
    console.log("Example: node scripts/reconcile-catalog-overrides.cjs inventory.json");
    return;
  }

  const abs = path.resolve(snapshotPath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  const { overrides, customParts } = loadSnapshot(abs);
  const customIds = new Set(
    customParts.map((p) => (p && typeof p.id === "string" ? p.id : null)).filter(Boolean),
  );
  const overrideIds = Object.keys(overrides);
  const orphaned = overrideIds.filter((id) => !seedIds.has(id) && !customIds.has(id));

  console.log(`Overrides in snapshot: ${overrideIds.length}`);
  console.log(`Custom parts in snapshot: ${customIds.size}`);
  console.log(`Orphaned override ids (not in seals/orings seed, not custom): ${orphaned.length}`);
  for (const id of orphaned.sort()) {
    console.log(`  orphan: ${id}`);
  }
  if (orphaned.length === 0) {
    console.log("No orphaned override ids.");
  }
}

main();
