import { kafuParts } from "../src/lib/kafu-inventory.ts";

type Row = {
  code: string;
  desc: string;
  oem: string;
  machine: string;
  page: string;
};

const data: Row[] = [
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
  { code: "A06-6", desc: "Water Temp Sensor", oem: "256-6453", machine: "CAT C7, C9 Engines", page: "15" },
  { code: "A06-7", desc: "Water Temp Sensor", oem: "238-0112", machine: "CAT E320D", page: "15" },
  { code: "A06-22", desc: "Water Temp Sensor", oem: "6D107 Engine Line", machine: "Komatsu PC200-8", page: "16" },
  { code: "A08-1", desc: "Oil-Water Separation Sensor", oem: "600-311-3721", machine: "Komatsu PC220-8, PC240-8", page: "22" },
  { code: "A08-2", desc: "Oil-Water Separation Sensor (3-Blade)", oem: "423-66434-01", machine: "CAT 320D", page: "22" },
  { code: "A10-1", desc: "High Pressure Sensor", oem: "LS52S00015P1 / 8607307", machine: "Kobelco SK-6E", page: "24" },
  { code: "A10-10", desc: "High-Pressure Sensor", oem: "7861-93-1812", machine: "Komatsu PC200-8", page: "24" },
  { code: "A11-5", desc: "Common Rail Sensor", oem: "6261-81-1900 / 0281002937", machine: "Komatsu PC200-8", page: "28" },
  { code: "A12-1", desc: "High-Pressure SCU Control Valve", oem: "0928400742", machine: "Isuzu 4HK1", page: "28" },
  { code: "A12-2", desc: "SCU Control Valve", oem: "0928400617 / 040H1003", machine: "Komatsu PC200-8", page: "28" },
  { code: "A12-5", desc: "High-Pressure SCU Valve (Long)", oem: "04226-E0061", machine: "Hino J05E", page: "28" },
  { code: "A13-1", desc: "Fuel Common Rail Log", oem: "6754-71-1210", machine: "Komatsu PC200-8", page: "30" },
  { code: "A14-3", desc: "Heavy-Duty Relay Block", oem: "Starter Relay Base", machine: "Komatsu PC200-8", page: "31" },
  { code: "A15-18", desc: "Heavy-Duty Starter Relay", oem: "600-815-2170 / 600-815-8940", machine: "PC200-7 Platforms", page: "35" },
  { code: "A16-2B", desc: "Ignition Key Switch", oem: "22B-06-11910", machine: "Komatsu PC200-8, PC240-8", page: "36" },
  { code: "A16-12", desc: "Ignition Key Switch", oem: "204-9069 / 24V", machine: "CAT E320D, E320D2", page: "36" },
  { code: "A17-3", desc: "Engine Controller (ECM)", oem: "600-467-1100 / 6261-81-1900", machine: "Komatsu PC200-8", page: "38" },
  { code: "A17-12", desc: "Engine Control Module (ECM)", oem: "C6.4 / 331-7531", machine: "CAT E320D", page: "39" },
  { code: "A18-3", desc: "Throttle Motor Assembly", oem: "247-5231 / 247-5229", machine: "CAT E320C, E312C", page: "41" },
  { code: "A18-4", desc: "Throttle Actuator Motor", oem: "305-4893 / 247-5212", machine: "CAT E320D, E323D", page: "41" },
  { code: "A18-7", desc: "Throttle Motor Assembly (7-Pin)", oem: "7834-41-2000 / 7834-41-3000", machine: "Komatsu PC200-7, PC220-7", page: "41" },
  { code: "A18-8", desc: "Throttle Motor Core Unit", oem: "7835-46-2000", machine: "Komatsu PC200-8, PC220-8", page: "42" },
  { code: "A18-27", desc: "Electronic Throttle Actuator", oem: "LQ24C00020F1", machine: "Kobelco SK200-8, SK350-8", page: "44" },
  { code: "A19-10", desc: "Solenoid Valve Assembly (6-Spool)", oem: "20Y-60-41611 / 20Y-60-41621", machine: "Komatsu PC200-8, PC220-8", page: "46" },
  { code: "A20-7", desc: "High-Definition Monitor Unit", oem: "7835-31-1002 / 7835-31-1000", machine: "Komatsu PC200-8", page: "52" },
  { code: "A21-8", desc: "High-Pressure Common Rail Wire Loom", oem: "600-467-1100 / 7835-31-1002", machine: "Komatsu PC200-8", page: "58" },
  { code: "A22-8", desc: "EPC Block Replacement Coil", oem: "702-21-07010 / 7835-31-1002", machine: "Komatsu PC200-8", page: "64" },
  { code: "A23-8", desc: "Glow Plug Preheater Controller", oem: "600-467-1100 Unit", machine: "Komatsu PC200-8", page: "70" },
  { code: "A24-8", desc: "Hydraulic Safety Lock Microswitch", oem: "600-467-1100 / 7835-31-1002", machine: "Komatsu PC200-8 Pilot Lever", page: "76" },
  { code: "A25-8", desc: "Intake Air Preheater Control Node", oem: "600-467-1100 Core", machine: "Komatsu PC200-8", page: "82" },
  { code: "A26-8", desc: "Solenoid Manifold Array (6-Valve Set)", oem: "20Y-60-41611 / 20Y-60-41621", machine: "Komatsu PC200-8, PC220-8", page: "88" },
  { code: "A27-9", desc: "Integrated Fan Belt Alternator (60A)", oem: "600-861-3111 / 600-861-3112", machine: "Komatsu PC200-8, PC240-8", page: "94" },
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
  { code: "A45-9", desc: "Engine Air Preheater Automation Switch", oem: "600-467-1100 Core Node", machine: "Komatsu PC200-8", page: "202" },
  { code: "A46-9", desc: "Pilot Line Logical EPC Reducing Valve", oem: "600-467-1100 Core Node", machine: "Komatsu PC200-8 Series", page: "208" },
];

const byCode = new Map(kafuParts.map((p) => [p.partNumber, p]));
const missing: string[] = [];
const present: string[] = [];
const mismatches: { code: string; issues: string[]; appDesc?: string; pyDesc: string }[] = [];

for (const row of data) {
  const p = byCode.get(row.code);
  if (!p) {
    missing.push(row.code);
    continue;
  }
  present.push(row.code);
  const issues: string[] = [];
  const appAll = (p.partNumbers ?? []).join(" ").toLowerCase();
  const pyOems = row.oem
    .split("/")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  // Skip fuzzy OEM prose like "6D107 Engine Line" / "Starter Relay Base"
  const looksLikeOem = pyOems.some((o) => /[0-9]/.test(o) && o.length >= 5);
  if (looksLikeOem && !pyOems.some((o) => appAll.includes(o))) {
    issues.push(`OEM: py=${row.oem} | app=${(p.partNumbers ?? []).slice(1).join(" / ")}`);
  }
  const page = (p.catalogPage ?? "").replace(/^Page\s*/i, "");
  if (row.page && page && page !== row.page) {
    issues.push(`Page: py=${row.page} app=${page}`);
  }
  if (issues.length) {
    mismatches.push({
      code: row.code,
      issues,
      appDesc: p.description ?? p.name,
      pyDesc: row.desc,
    });
  }
}

const a45 = kafuParts.filter((p) => p.partNumber.startsWith("A45"));
const prefixes: Record<string, number> = {};
for (const p of kafuParts) {
  const m = p.partNumber.match(/^(A\d+)/);
  if (m) prefixes[m[1]] = (prefixes[m[1]] || 0) + 1;
}

const sample = byCode.get("A01-1");

console.log(
  JSON.stringify(
    {
      pyRows: data.length,
      appKafuTotal: kafuParts.length,
      present: present.length,
      missing,
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, 20),
      a45Count: a45.length,
      a45Sample: a45.slice(0, 8).map((p) => p.partNumber),
      prefixCounts: Object.fromEntries(
        Object.entries(prefixes).sort((a, b) =>
          a[0].localeCompare(b[0], undefined, { numeric: true }),
        ),
      ),
      sampleA01_1: sample
        ? {
            partNumber: sample.partNumber,
            description: sample.description,
            oems: (sample.partNumbers || []).slice(1),
            machine: sample.compatibility,
            page: sample.catalogPage,
            category: sample.category,
          }
        : null,
    },
    null,
    2,
  ),
);
