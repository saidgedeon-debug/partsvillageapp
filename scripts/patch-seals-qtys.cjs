const fs = require("fs");
const XLSX = require("xlsx");

const report = XLSX.readFile(
  "c:/Users/saidg/OneDrive/Desktop/FINAL new inventory - sync report.xlsx",
);
const all = XLSX.utils.sheet_to_json(report.Sheets["All from file"]);
const qtyByCode = new Map(
  all.map((r) => [
    String(r.code).trim().toLowerCase().replace(/\s+/g, " "),
    Number(r.qty) || 0,
  ]),
);

let text = fs.readFileSync("src/lib/seals-inventory.ts", "utf8");
let patched = 0;

text = text.replace(/\{\n([\s\S]*?)\n  \},?/g, (block) => {
  const pn = block.match(/partNumber:\s*"([^"]+)"/)?.[1];
  if (!pn) return block;
  const k = pn.trim().toLowerCase().replace(/\s+/g, " ");
  if (!qtyByCode.has(k)) return block;
  const qty = qtyByCode.get(k);
  const next = block.replace(/quantity:\s*-?\d+/, `quantity: ${qty}`);
  if (next !== block) patched += 1;
  return next;
});

fs.writeFileSync("src/lib/seals-inventory.ts", text);
console.log(
  JSON.stringify({ patched, fileRows: qtyByCode.size }, null, 2),
);
