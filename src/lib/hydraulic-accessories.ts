/** Gauges & Accessories subcategory seed — Hydraulic Parts (Stand 58–59). */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "Gauges & Accessories";

function accessory(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  stand: 58 | 59;
  componentType: string;
  compatibility: string[];
  thread?: string;
  diameter?: string;
  typeVariant?: string;
}): Part {
  const detailBits = [
    opts.componentType,
    opts.thread ? `thread ${opts.thread}` : null,
    opts.diameter ? `Ø${opts.diameter}` : null,
    opts.typeVariant ?? null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    `Stand ${opts.stand}`,
    `Manufacturer: ${handok}`,
    `Type: ${opts.componentType}`,
    opts.thread ? `Thread: ${opts.thread}` : null,
    opts.diameter ? `Diameter: ${opts.diameter}` : null,
    opts.typeVariant ? `Variant: ${opts.typeVariant}` : null,
    `OEM xref: ${opts.partNumbers.join(", ")}`,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: [handok, opts.name, ...detailBits].join(" · "),
    category: "Hydraulic Parts",
    subcategory: sub,
    boxNumber: opts.stand,
    quantity: opts.quantity,
    reorderAt: Math.max(1, Math.min(2, Math.floor(opts.quantity / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: opts.compatibility,
    notes: noteBits.join(" · "),
  };
}

/** Stand 58–59 Handok pump accessories */
export const hydraulicAccessoryParts: Part[] = [
  // —— Stand 58 ——
  accessory({
    id: "hydraulic-acc-4178173",
    partNumber: "4178173",
    partNumbers: ["4178173"],
    name: "Lock Nut of Drive Shaft (HPV0102 M60X2.0P)",
    quantity: 5,
    stand: 58,
    componentType: "Lock Nut",
    thread: "M60X2.0P",
    compatibility: ["Komatsu HPV0102"],
  }),
  accessory({
    id: "hydraulic-acc-18982",
    partNumber: "18982",
    partNumbers: ["18982"],
    name: "Space of Ball Guide (K3V140)",
    quantity: 4,
    stand: 58,
    componentType: "Ball Guide Spacer",
    diameter: "60.2mm",
    compatibility: ["Kawasaki K3V140"],
  }),
  accessory({
    id: "hydraulic-acc-20534",
    partNumber: "20534",
    partNumbers: ["20534"],
    name: "Tilting Pin (K3V112DT)",
    quantity: 4,
    stand: 58,
    componentType: "Tilting Pin",
    compatibility: ["Kawasaki K3V112DT"],
  }),
  accessory({
    id: "hydraulic-acc-0451106-180",
    partNumber: "0451106-180",
    partNumbers: ["0451106-180", "0451106180"],
    name: "Feed Back Lever (K3V180 3L=TYPE)",
    quantity: 2,
    stand: 58,
    componentType: "Feedback Lever",
    typeVariant: "3L=TYPE",
    compatibility: ["Kawasaki K3V180"],
  }),
  accessory({
    id: "hydraulic-acc-708-2l-24122-s58",
    partNumber: "708-2L-24122",
    partNumbers: ["708-2L-24122", "7082L24122"],
    name: "Tilting Pin (HPV95C)",
    quantity: 1,
    stand: 58,
    componentType: "Tilting Pin",
    compatibility: ["Komatsu HPV95C"],
  }),
  // —— Stand 59 ——
  accessory({
    id: "hydraulic-acc-708-2l-24122",
    partNumber: "708-2L-24122",
    partNumbers: ["708-2L-24122", "7082L24122"],
    name: "Tilting Pin (HPV05C)",
    quantity: 1,
    stand: 59,
    componentType: "Tilting Pin",
    compatibility: ["Komatsu HPV05C"],
  }),
  accessory({
    id: "hydraulic-acc-53801869",
    partNumber: "53801869",
    partNumbers: ["53801869"],
    name: "Feedback Lever (K3V140 Regulator)",
    quantity: 2,
    stand: 59,
    componentType: "Regulator Feedback Lever",
    compatibility: ["Kawasaki K3V140"],
  }),
  accessory({
    id: "hydraulic-acc-43921",
    partNumber: "43921",
    partNumbers: ["43921"],
    name: "Holder of Disk Spring (HPV0102)",
    quantity: 20,
    stand: 59,
    componentType: "Disk Spring Holder",
    compatibility: ["Komatsu HPV0102"],
  }),
  accessory({
    id: "hydraulic-acc-39157",
    partNumber: "39157",
    partNumbers: ["39157"],
    name: "Holder of Disk Spring (HPV0102 Alt)",
    quantity: 50,
    stand: 59,
    componentType: "Disk Spring Holder",
    compatibility: ["Komatsu HPV0102"],
  }),
  accessory({
    id: "hydraulic-acc-41355",
    partNumber: "41355",
    partNumbers: ["41355"],
    name: "Coil Spring of Cylinder (K3V180)",
    quantity: 4,
    stand: 59,
    componentType: "Cylinder Coil Spring",
    compatibility: ["Kawasaki K3V180"],
  }),
];
