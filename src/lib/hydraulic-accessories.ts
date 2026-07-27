/** Gauges & Accessories subcategory seed — Hydraulic Parts (Stand 59). */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "Gauges & Accessories";

function accessory(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  componentType: string;
  compatibility: string[];
}): Part {
  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: `${handok} · ${opts.name} · ${opts.componentType}`,
    category: "Hydraulic Parts",
    subcategory: sub,
    boxNumber: 59,
    quantity: opts.quantity,
    reorderAt: Math.max(1, Math.min(2, Math.floor(opts.quantity / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: opts.compatibility,
    notes: `Subcategory: ${sub} · Stand 59 · Manufacturer: ${handok} · Type: ${opts.componentType} · OEM xref: ${opts.partNumbers.join(", ")}`,
  };
}

/** Stand 59 Handok pump accessories */
export const hydraulicAccessoryParts: Part[] = [
  accessory({
    id: "hydraulic-acc-708-2l-24122",
    partNumber: "708-2L-24122",
    partNumbers: ["708-2L-24122", "7082L24122"],
    name: "Tilting Pin (HPV05C)",
    quantity: 1,
    componentType: "Tilting Pin",
    compatibility: ["Komatsu HPV05C"],
  }),
  accessory({
    id: "hydraulic-acc-53801869",
    partNumber: "53801869",
    partNumbers: ["53801869"],
    name: "Feedback Lever (K3V140 Regulator)",
    quantity: 2,
    componentType: "Regulator Feedback Lever",
    compatibility: ["Kawasaki K3V140"],
  }),
  accessory({
    id: "hydraulic-acc-43921",
    partNumber: "43921",
    partNumbers: ["43921"],
    name: "Holder of Disk Spring (HPV0102)",
    quantity: 20,
    componentType: "Disk Spring Holder",
    compatibility: ["Komatsu HPV0102"],
  }),
  accessory({
    id: "hydraulic-acc-39157",
    partNumber: "39157",
    partNumbers: ["39157"],
    name: "Holder of Disk Spring (HPV0102 Alt)",
    quantity: 50,
    componentType: "Disk Spring Holder",
    compatibility: ["Komatsu HPV0102"],
  }),
  accessory({
    id: "hydraulic-acc-41355",
    partNumber: "41355",
    partNumbers: ["41355"],
    name: "Coil Spring of Cylinder (K3V180)",
    quantity: 4,
    componentType: "Cylinder Coil Spring",
    compatibility: ["Kawasaki K3V180"],
  }),
];
