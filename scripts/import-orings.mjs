import fs from "node:fs";
import path from "node:path";

const raw = fs.readFileSync(
  path.join(process.env.TEMP, "ai-orings-inspect", "ai.txt"),
  "utf8",
);
const lines = raw.split(/\r?\n/).filter((l) => /^Box \d+,/.test(l));
const parts = [];
const skipped = [];

for (const line of lines) {
  const m = line.match(/^Box (\d+),([^,]+),([^,]*),([^,]*),(\d+)(?:,(.*))?$/);
  if (!m) {
    skipped.push(line);
    continue;
  }
  const [, box, code, idMm, csMm, qty, notesRaw] = m;
  const notes = (notesRaw || "").trim().replace(/,$/, "");
  const idx = parts.length + 1;
  const id = `oring-${String(idx).padStart(4, "0")}`;
  const name =
    csMm === "Metric CS" || idMm === "Metric ID"
      ? `O-Ring ${code.trim()}`
      : `O-Ring ${code.trim()} · ${idMm}×${csMm} mm`;
  parts.push({
    id,
    partNumber: code.trim(),
    name,
    category: "O-Rings",
    quantity: Number(qty),
    reorderAt: 0,
    cost: 0,
    price: 0,
    compatibility: [],
    boxNumber: Number(box),
    insideDiameterMm: idMm.trim(),
    crossSectionMm: csMm.trim(),
    notes,
  });
}

console.log("parsed", parts.length, "skipped", skipped.length);
if (skipped.length) console.log("SKIPPED:\n" + skipped.join("\n"));
const byBox = {};
for (const p of parts) byBox[p.boxNumber] = (byBox[p.boxNumber] || 0) + 1;
console.log("by box", byBox);

const tsBody = parts
  .map((p) => {
    const notes = JSON.stringify(p.notes);
    return `  {
    id: ${JSON.stringify(p.id)},
    partNumber: ${JSON.stringify(p.partNumber)},
    name: ${JSON.stringify(p.name)},
    category: "O-Rings",
    quantity: ${p.quantity},
    reorderAt: 0,
    cost: 0,
    price: 0,
    compatibility: [],
    boxNumber: ${p.boxNumber},
    insideDiameterMm: ${JSON.stringify(p.insideDiameterMm)},
    crossSectionMm: ${JSON.stringify(p.crossSectionMm)},
    notes: ${notes},
  }`;
  })
  .join(",\n");

const ts = `/** Auto-generated from ai.zip O-ring master inventory. Costs/prices TBD. */
import type { Part } from "@/lib/mock-data";

export const oringParts: Part[] = [
${tsBody},
];
`;

fs.writeFileSync("src/lib/orings-inventory.ts", ts);

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const sqlRows = parts
  .map(
    (p) =>
      `('${esc(p.id)}', '${esc(p.partNumber)}', '${esc(p.name)}', 'O-Rings', ${p.quantity}, 0, 0, 0, '{}', ${p.boxNumber}, '${esc(p.insideDiameterMm)}', '${esc(p.crossSectionMm)}', '${esc(p.notes)}')`,
  )
  .join(",\n  ");

const sql = `-- O-Rings inventory (costs/prices left at 0)
insert into public.parts (id, part_number, name, category, quantity, reorder_at, cost, price, compatibility, box_number, inside_diameter_mm, cross_section_mm, notes)
values
  ${sqlRows};
`;

fs.writeFileSync("supabase/seed-orings.sql", sql);
console.log("wrote src/lib/orings-inventory.ts and supabase/seed-orings.sql");
