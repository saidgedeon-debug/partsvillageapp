/**
 * Apply the user-sent catalog list as source of truth for those part codes.
 * OEM rules:
 *   - "600-467-1100 Unit/Core/Core Node" → "600-467-1100"
 *   - "6D107 Engine Line" → "6D107 Engine"
 * Wrong part data in app is overwritten by the user list.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { kafuParts } from "../src/lib/kafu-inventory.ts";
import type { Part } from "../src/lib/mock-data.ts";

type Row = {
  code: string;
  desc: string;
  oem: string;
  machine: string;
  page: string;
};

const USER_LIST: Row[] = [
  { code: "A01-1", desc: "Revolution Sensor", oem: "7861-93-2330", machine: "Komatsu PC200-7, PC220-7", page: "5" },
  { code: "A01-1A", desc: "Revolution Sensor", oem: "2055358", machine: "Hitachi Series", page: "5" },
  { code: "A01-1B", desc: "Revolution Sensor", oem: "ME844577", machine: "Komatsu SK200-6, SK200-6E", page: "5" },
  { code: "A01-2", desc: "Revolution Sensor", oem: "ME845235", machine: "Komatsu SK200-3, SK200-5", page: "5" },
  { code: "A01-5", desc: "Revolution Sensor", oem: "196-7973 / 125-2966", machine: "Caterpillar E320", page: "5" },
  { code: "A01-6", desc: "Revolution Sensor", oem: "324-4131", machine: "Caterpillar E320D", page: "5" },
  { code: "A02-12A", desc: "Camshaft Sensor", oem: "254-4630 / 169-3300", machine: "Caterpillar E325C", page: "7" },
  { code: "A02-13", desc: "Camshaft Sensor", oem: "238-0120", machine: "Caterpillar E320D", page: "7" },
  { code: "A02-22A", desc: "Camshaft Sensor", oem: "6754-81-9410 / D4921684", machine: "Komatsu PC200-8", page: "8" },
  { code: "A03-12", desc: "Air Pressure Sensor", oem: "266-0136", machine: "CAT E312D", page: "9" },
  { code: "A03-3", desc: "Air Pressure Sensor", oem: "4076493 / 6261-81-1900", machine: "Komatsu PC200-8", page: "9" },
  { code: "A03-6", desc: "Air Intake Sensor", oem: "0281002566 / 0281002576", machine: "VOLVO EC210", page: "9" },
  { code: "A04-8", desc: "Oil Pressure Sensor", oem: "266-0210 / 51-8005", machine: "CAT E320C", page: "10" },
  { code: "A04-24", desc: "Oil Pressure Sensor", oem: "04215774ED / 21291011", machine: "VOLVO EC210 (D6D Engine)", page: "11" },
  { code: "A05-1", desc: "Water Temp Sensor", oem: "24424110", machine: "VOLVO 360", page: "14" },
  { code: "A05-2", desc: "Water Temp Sensor (200mm)", oem: "21391697 / 20840227", machine: "VOLVO 210, 210B", page: "14" },
  { code: "A06-6", desc: "Water Temp Sensor", oem: "256-6453", machine: "CAT C7, C9 Engines (Φ19 Thread)", page: "15" },
  { code: "A06-7", desc: "Water Temp Sensor", oem: "238-0112", machine: "CAT E320D (Φ18 Thread)", page: "15" },
  { code: "A06-22", desc: "Water Temp Sensor", oem: "6D107 Engine Line", machine: "Komatsu PC200-8", page: "16" },
  { code: "A08-1", desc: "Oil-Water Separation Sensor", oem: "600-311-3721", machine: "Komatsu PC220-8, PC240-8", page: "22" },
  { code: "A08-2", desc: "Oil-Water Separation Sensor (3-Blade)", oem: "423-66434-01", machine: "CAT 320D", page: "22" },
  { code: "A10-1", desc: "High Pressure Sensor", oem: "LS52S00015P1 / 8607307", machine: "Kobelco SK-6E", page: "24" },
  { code: "A10-10", desc: "High-Pressure Sensor", oem: "7861-93-1812", machine: "Komatsu PC200-8", page: "24" },
  { code: "A11-5", desc: "Common Rail Sensor", oem: "6261-81-1900 / 0281002937", machine: "Komatsu PC200-8", page: "28" },
  { code: "A12-1", desc: "High-Pressure SCU Control Valve", oem: "0928400742", machine: "Isuzu 4HK1 / 6HK1 / Kobelco SK130-8", page: "28" },
  { code: "A12-2", desc: "SCU Control Valve", oem: "0928400617 / 040H1003", machine: "Komatsu PC200-8", page: "28" },
  { code: "A12-5", desc: "High-Pressure SCU Valve (Long)", oem: "04226-E0061", machine: "Hino J05E / J08E / Kobelco SK200-8", page: "28" },
  { code: "A13-1", desc: "Fuel Common Rail Log", oem: "6754-71-1210", machine: "Komatsu PC200-8", page: "30" },
  { code: "A14-3", desc: "Heavy-Duty Relay Block", oem: "Starter Relay Base", machine: "Komatsu PC200-8", page: "31" },
  { code: "A15-18", desc: "Heavy-Duty Starter Relay", oem: "600-815-2170 / 600-815-8940", machine: "PC200-7 Platforms", page: "35" },
  { code: "A16-2B", desc: "Ignition Key Switch", oem: "22B-06-11910", machine: "Komatsu PC200-8, PC240-8", page: "36" },
  { code: "A16-12", desc: "Ignition Key Switch", oem: "204-9069 / 24V", machine: "CAT E320D, E320D2", page: "36" },
  { code: "A17-3", desc: "Engine Controller (ECM)", oem: "600-467-1100 / 6261-81-1900", machine: "Komatsu PC200-8 (6D107 Engine)", page: "38" },
  { code: "A17-12", desc: "Engine Control Module (ECM)", oem: "C6.4 / 331-7531", machine: "CAT E320D (C6.4 Engine)", page: "39" },
  { code: "A18-3", desc: "Throttle Motor Assembly", oem: "247-5231 / 247-5229", machine: "CAT E320C, E312C", page: "41" },
  { code: "A18-4", desc: "Throttle Actuator Motor", oem: "305-4893 / 247-5212", machine: "CAT E320D, E323D", page: "41" },
  { code: "A18-7", desc: "Throttle Motor Assembly (7-Pin)", oem: "7834-41-2000 / 7834-41-3000", machine: "Komatsu PC200-7, PC220-7", page: "41" },
  { code: "A18-8", desc: "Throttle Motor Core Unit", oem: "7835-46-2000", machine: "Komatsu PC200-8, PC220-8", page: "42" },
  { code: "A18-27", desc: "Electronic Throttle Actuator", oem: "LQ24C00020F1", machine: "Kobelco SK200-8, SK350-8", page: "44" },
  { code: "A19-10", desc: "Solenoid Valve Assembly (6-Spool)", oem: "20Y-60-41611 / 20Y-60-41621", machine: "Komatsu PC200-8, PC220-8", page: "46" },
  { code: "A20-7", desc: "High-Definition Monitor Unit", oem: "7835-31-1002 / 7835-31-1000", machine: "Komatsu PC200-8, PC240-8, PC300-8", page: "52" },
  { code: "A21-8", desc: "High-Pressure Common Rail Wire Loom", oem: "600-467-1100 / 7835-31-1002", machine: "Komatsu PC200-8 (6D107 Engine)", page: "58" },
  { code: "A22-8", desc: "EPC Block Replacement Coil", oem: "702-21-07010 / 7835-31-1002", machine: "Komatsu PC200-8 (Main Valve)", page: "64" },
  { code: "A23-8", desc: "Glow Plug Preheater Controller", oem: "600-467-1100 Unit", machine: "Komatsu PC200-8 (6D107 Engine)", page: "70" },
  { code: "A24-8", desc: "Hydraulic Safety Lock Microswitch", oem: "600-467-1100 / 7835-31-1002", machine: "Komatsu PC200-8 Pilot Lever", page: "76" },
  { code: "A25-8", desc: "Intake Air Preheater Control Node", oem: "600-467-1100 Core", machine: "Komatsu PC200-8 (6D107 Engine)", page: "82" },
  { code: "A26-8", desc: "Solenoid Manifold Array (6-Valve Set)", oem: "20Y-60-41611 / 20Y-60-41621", machine: "Komatsu PC200-8, PC220-8", page: "88" },
  { code: "A27-9", desc: "Integrated Fan Belt Alternator (60A)", oem: "600-861-3111 / 600-861-3112", machine: "Komatsu PC200-8, PC240-8 (6D107)", page: "94" },
  { code: "A28-9", desc: "Eco-Drive AC Compressor Unit", oem: "20Y-979-7111 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "100" },
  { code: "A29-9", desc: "Integrated Overrunning Clutch Starter", oem: "600-863-3111 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "106" },
  { code: "A30-9", desc: "Multi-Layer Steel Head Gasket Set", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "112" },
  { code: "A31-9", desc: "Heavy Duty Compression Ring Matrix", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "118" },
  { code: "A32-9", desc: "Heavy Duty Dual Valve Spring Set", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "124" },
  { code: "A33-9", desc: "Heavy Duty Main Journal Shell Kit", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "130" },
  { code: "A34-9", desc: "Camshaft Drive Gear (Keyway Alignment)", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "136" },
  { code: "A35-9", desc: "High-Efficiency Flow Water Pump", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "142" },
  { code: "A36-9", desc: "High-Pressure Wastegate Turbocharger", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "148" },
  { code: "A37-9", desc: "High-Pressure Fuel Injection Pump (HP3)", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "154" },
  { code: "A38-9", desc: "Radiator Expansion Water Tank Assembly", oem: "6261-81-1900 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "160" },
  { code: "A39-9", desc: "Main Pump Assembly (HPV112 Series)", oem: "708-2L-00600 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "166" },
  { code: "A40-9", desc: "Complete Final Drive Motor & Gearbox Unit", oem: "708-2L-00600 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "172" },
  { code: "A41-9", desc: "Induction Hardened Arm Cylinder Rod", oem: "707-99-71111 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "178" },
  { code: "A42-9", desc: "Segmented Tooth Drive Sprocket Rim", oem: "20Y-30-00411 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "184" },
  { code: "A43-9", desc: "Eco-Friendly Cartridge Oil Filter Unit", oem: "6754-71-6130 / 6D107 Engine", machine: "Komatsu PC200-8, PC240-8", page: "190" },
  { code: "A44-9", desc: "Multi-Station Solenoid Block (6-Spool)", oem: "20Y-60-41611 / 20Y-60-41621", machine: "Komatsu PC200-8, PC220-8", page: "196" },
  { code: "A45-9", desc: "Engine Air Preheater Automation Switch", oem: "600-467-1100 Core Node", machine: "Komatsu PC200-8 (6D107 Engine)", page: "202" },
  { code: "A46-9", desc: "Pilot Line Logical EPC Reducing Valve", oem: "600-467-1100 Core Node", machine: "Komatsu PC200-8 Series", page: "208" },
];

/** Clean one OEM token per user rules. */
function cleanOemToken(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";

  // 6D107 Engine Line → 6D107 Engine
  if (/^6D107\s+Engine\s+Line$/i.test(t)) return "6D107 Engine";

  // Strip trailing Unit / Core / Core Node (keep the code)
  t = t.replace(/\s+(Unit|Core Node|Core)$/i, "").trim();

  return t;
}

function cleanOems(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(/\s*\/\s*/)) {
    const t = cleanOemToken(piece);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function splitMachines(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function categoryFromDesc(desc: string): string {
  const d = desc.trim();
  if (/camshaft/i.test(d)) return "Camshaft Sensor";
  if (/revolution/i.test(d)) return "Revolution Sensor";
  if (/air intake/i.test(d)) return "Air Intake Sensor";
  if (/air pressure/i.test(d)) return "Air Pressure Sensor";
  if (/oil pressure/i.test(d)) return "Oil Pressure Sensor";
  if (/water temp/i.test(d)) return "Water Temperature Sensor";
  if (/oil-water|separation/i.test(d)) return "Oil-Water Separation Sensor";
  if (/common rail sensor/i.test(d)) return "Common Rail Sensor";
  if (/high.?pressure sensor/i.test(d)) return "High Pressure Sensor";
  if (/scu|control valve/i.test(d)) return "SCU / Control Valve";
  if (/common rail log|fuel common/i.test(d)) return "Fuel Common Rail";
  if (/relay/i.test(d)) return "Relay";
  if (/glow/i.test(d)) return "Relay / Glow Control";
  if (/preheater/i.test(d)) return "Preheater Control";
  if (/microswitch|safety lock/i.test(d)) return "Safety Switch";
  if (/ecm|engine controller|control module/i.test(d)) return "Engine Controller";
  if (/ignition|key switch/i.test(d)) return "Ignition Switch";
  if (/throttle/i.test(d)) return "Throttle Motor";
  if (/solenoid/i.test(d)) return "Solenoid Valve";
  if (/monitor/i.test(d)) return "Monitor Unit";
  if (/wire loom|harness/i.test(d)) return "Wire Harness";
  if (/relay/i.test(d)) return "Relay";
  if (/alternator/i.test(d)) return "Alternator";
  if (/compressor/i.test(d)) return "AC Compressor";
  if (/starter/i.test(d)) return "Starter";
  if (/gasket/i.test(d)) return "Gasket";
  if (/ring matrix|compression ring/i.test(d)) return "Piston Rings";
  if (/valve spring/i.test(d)) return "Valve Spring";
  if (/journal|bearing/i.test(d)) return "Bearing Kit";
  if (/camshaft drive gear|drive gear/i.test(d)) return "Camshaft Gear";
  if (/water pump/i.test(d)) return "Water Pump";
  if (/turbo/i.test(d)) return "Turbocharger";
  if (/injection pump|hp3/i.test(d)) return "Injection Pump";
  if (/radiator|expansion|water tank/i.test(d)) return "Cooling Tank";
  if (/main pump|hpv/i.test(d)) return "Main Pump";
  if (/final drive/i.test(d)) return "Final Drive";
  if (/cylinder rod/i.test(d)) return "Cylinder Rod";
  if (/sprocket/i.test(d)) return "Sprocket";
  if (/oil filter|filter unit/i.test(d)) return "Filter";
  if (/epc|reducing valve|manifold|block/i.test(d)) return "Control Manifold / Block";
  return d;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function rowToPart(row: Row, existing?: Part): Part {
  const oems = cleanOems(row.oem);
  const machines = splitMachines(row.machine);
  const category = existing?.category && !/revolution sensor/i.test(existing.category)
    ? // Still prefer desc-derived when user changed description type (e.g. Camshaft)
      categoryFromDesc(row.desc)
    : categoryFromDesc(row.desc);
  const name =
    machines.length > 0
      ? `${row.desc} — ${machines.slice(0, 3).join(", ")}`
      : row.desc;
  const partNumbers = [row.code, ...oems.filter((o) => o.toLowerCase() !== row.code.toLowerCase())];
  const notesParts = [
    oems.length ? `OEM: ${oems.join(", ")}` : "",
    `Catalog p.${row.page}`,
    "Supplier: Kafu",
  ].filter(Boolean);

  return {
    id: existing?.id ?? `kafu-${row.code.toLowerCase()}`,
    partNumber: row.code,
    partNumbers,
    name: name.length > 140 ? `${name.slice(0, 137)}...` : name,
    description: row.desc,
    category,
    quantity: existing?.quantity ?? 0,
    reorderAt: existing?.reorderAt ?? 0,
    cost: existing?.cost ?? 0,
    price: existing?.price ?? 0,
    compatibility: machines,
    catalogPage: row.page,
    notes: notesParts.join(" · "),
    imageUrl: existing?.imageUrl,
  };
}

function writeTs(parts: Part[]) {
  const lines: string[] = [
    'import type { Part } from "@/lib/mock-data";',
    "",
    "/**",
    " * Kafu catalog — columns match extraction schema:",
    " * Part Code | Description | OEM / Serial | Machine Compatibility | Page",
    " */",
    "export const kafuParts: Part[] = [",
  ];

  for (const p of parts) {
    const numbers = p.partNumbers?.length ? p.partNumbers : [p.partNumber];
    lines.push("  {");
    lines.push(`    id: "${esc(p.id)}",`);
    lines.push(`    partNumber: "${esc(p.partNumber)}",`);
    lines.push(
      `    partNumbers: [${numbers.map((n) => `"${esc(n)}"`).join(", ")}],`,
    );
    lines.push(`    name: "${esc(p.name)}",`);
    lines.push(`    description: "${esc(p.description ?? p.name)}",`);
    lines.push(`    category: "${esc(p.category)}",`);
    lines.push(`    quantity: ${p.quantity},`);
    lines.push(`    reorderAt: ${p.reorderAt},`);
    lines.push(`    cost: ${p.cost},`);
    lines.push(`    price: ${p.price},`);
    lines.push(
      `    compatibility: [${p.compatibility.map((c) => `"${esc(c)}"`).join(", ")}],`,
    );
    if (p.catalogPage) {
      lines.push(`    catalogPage: "${esc(p.catalogPage)}",`);
    }
    if (p.notes) {
      lines.push(`    notes: "${esc(p.notes)}",`);
    }
    if (p.imageUrl) {
      lines.push(`    imageUrl: "${esc(p.imageUrl)}",`);
    }
    lines.push("  },");
  }

  lines.push("];", "");
  const out = join(process.cwd(), "src", "lib", "kafu-inventory.ts");
  writeFileSync(out, lines.join("\n") + "\n", "utf8");
}

const byCode = new Map(kafuParts.map((p) => [p.partNumber, p]));
let updated = 0;
let added = 0;
const changed: string[] = [];

for (const row of USER_LIST) {
  const existing = byCode.get(row.code);
  const next = rowToPart(row, existing);
  if (existing) {
    const before = JSON.stringify({
      d: existing.description,
      o: existing.partNumbers,
      c: existing.compatibility,
      p: existing.catalogPage,
      cat: existing.category,
    });
    const after = JSON.stringify({
      d: next.description,
      o: next.partNumbers,
      c: next.compatibility,
      p: next.catalogPage,
      cat: next.category,
    });
    if (before !== after) {
      updated += 1;
      changed.push(row.code);
    }
    byCode.set(row.code, next);
  } else {
    added += 1;
    changed.push(`${row.code} (NEW)`);
    byCode.set(row.code, next);
  }
}

const merged = [...byCode.values()].sort((a, b) =>
  a.partNumber.localeCompare(b.partNumber, undefined, {
    numeric: true,
    sensitivity: "base",
  }),
);

writeTs(merged);

console.log(
  JSON.stringify(
    {
      total: merged.length,
      updated,
      added,
      changed,
      samples: {
        "A02-12A": byCode.get("A02-12A"),
        "A02-13": byCode.get("A02-13"),
        "A06-22": byCode.get("A06-22"),
        "A23-8": byCode.get("A23-8"),
        "A45-9": byCode.get("A45-9"),
        "A46-9": byCode.get("A46-9"),
      },
    },
    null,
    2,
  ),
);
