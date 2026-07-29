/** valves subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "valves";

export function hydraulicValve(opts: {
  id: string;
  partNumber: string;
  partNumbers?: string[];
  name?: string;
  description?: string;
  classification?: string;
  quantity: number;
  stand?: number;
  brand?: string;
  origin?: string;
  specs?: string[];
  pumps?: string[];
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const partNumbers = opts.partNumbers?.length
    ? [...opts.partNumbers]
    : [opts.partNumber];
  const brand = opts.brand?.trim() || handok;
  const name =
    opts.name?.trim() ||
    opts.classification?.trim() ||
    opts.description?.trim() ||
    `Valve ${opts.partNumber}`;
  const detailBits = [
    opts.classification ?? null,
    opts.description ?? null,
    ...(opts.specs ?? []),
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    `Manufacturer: ${brand}`,
    opts.origin?.trim() ? `Origin: ${opts.origin.trim()}` : null,
    opts.classification ? `Class: ${opts.classification}` : null,
    opts.description ? `Desc: ${opts.description}` : null,
    opts.specs?.length ? `Specs: ${opts.specs.join("; ")}` : null,
    opts.pumps?.length ? `Pumps: ${opts.pumps.join("; ")}` : null,
    `OEM xref: ${partNumbers.join(", ")}`,
    opts.notesExtra ?? null,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers,
    name,
    description: [brand, ...detailBits].join(" · "),
    category: "Hydraulic Parts",
    subcategory: sub,
    boxNumber: opts.stand,
    quantity: opts.quantity,
    reorderAt: Math.max(1, Math.min(2, Math.floor(opts.quantity / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: opts.compatibility ?? [],
    notes: noteBits.join(" · "),
  };
}

/** Valves stock — Stand 10. */
export const hydraulicValveParts: Part[] = [
  hydraulicValve({
    id: "hydraulic-valve-04929-s10",
    partNumber: "04929",
    partNumbers: ["04929", "HD-04929"],
    name: "Relief / Control Valve Assembly",
    classification: "Relief / Control Valve Assembly",
    brand: "Handok Hydraulic",
    quantity: 1,
    stand: 10,
    specs: [
      "Pilot-Operated Pressure Control",
      "34.3 MPa (350 bar)",
      "Standard Line Capacity",
      "High-Tensile Induction-Hardened Alloy Steel",
    ],
    pumps: [
      "Kawasaki K3V Series (K3V63 / K3V112DT)",
      "Handok Independent Replacement Assemblies",
    ],
    compatibility: [
      "Komatsu PC200-6",
      "Komatsu PC200-7",
      "Kobelco SK200-3",
      "Kobelco SK200-5",
      "Daewoo Solar",
      "Doosan Solar",
      "Kawasaki K3V63",
      "Kawasaki K3V112DT",
    ],
  }),
  hydraulicValve({
    id: "hydraulic-valve-17220-s10",
    partNumber: "17220",
    partNumbers: ["17220", "HD-17220"],
    name: "EPR Valve with Integrated Manifold",
    classification: "EPR Valve with Integrated Manifold",
    brand: "Handok Hydraulic",
    quantity: 1,
    stand: 10,
    specs: [
      "Proportional Electro-Pressure Regulating Valve",
      "Solenoid coil 17.5 Ω",
      "Lead-Wire Contact Terminal (Positive Control)",
      "Fluorocarbon / Viton High-Temp O-Rings",
    ],
    pumps: [
      "Handok H3V63DT Series",
      "Linde HPR3S-40A1-201-M1 Baseline Core",
      "Kayaba Type Positive Control Gear Configurations",
    ],
    compatibility: [
      "Kobelco excavators (dynamic flow control)",
      "New Holland crawlers",
      "New Holland medium excavators",
      "Handok H3V63DT",
      "Linde HPR3S-40A1-201-M1",
      "Kayaba",
    ],
  }),
  hydraulicValve({
    id: "hydraulic-valve-41331-s10",
    partNumber: "41331",
    partNumbers: ["41331", "HD-41331"],
    name: "Self-Reducing / Pilot Control Valve",
    classification: "Self-Reducing / Pilot Control Valve",
    brand: "Handok Hydraulic",
    quantity: 2,
    stand: 10,
    specs: [
      "Pressure Reducing / Proportional Valve Pack",
      "Standard Low-Pressure Pilot Circuitry",
      "Heavy Industrial Block Assembly",
      "Threaded O-Ring Boss Ports",
    ],
    pumps: [
      "Handok Independent Main Pumps",
      "Kawasaki K5V / K3V Pilot Circuit Manifolds",
    ],
    compatibility: [
      "Komatsu PC200-6",
      "Komatsu PC200-7",
      "Komatsu PC200-8",
      "Hyundai R210LC",
      "Hyundai R290LC",
      "Kawasaki K5V",
      "Kawasaki K3V",
    ],
  }),
];
