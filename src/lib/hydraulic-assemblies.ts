/** Complete Assemblies & Motors subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const aftermarket = "Aftermarket Premium Grade";
const sub = "Complete Assemblies & Motors";

export function hydraulicAssembly(opts: {
  id: string;
  partNumber: string;
  partNumbers?: string[];
  name: string;
  description?: string;
  quantity: number;
  stand?: number;
  brand?: string;
  model?: string;
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const brand = opts.brand?.trim() || aftermarket;
  const partNumbers = opts.partNumbers?.length
    ? [...opts.partNumbers]
    : [opts.partNumber];
  if (opts.model?.trim()) {
    const m = opts.model.trim();
    if (!partNumbers.some((p) => p.toLowerCase() === m.toLowerCase())) {
      partNumbers.push(m);
    }
  }
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    `Manufacturer: ${brand}`,
    opts.model ? `Model: ${opts.model}` : null,
    opts.description ? `Desc: ${opts.description}` : null,
    `OEM xref: ${partNumbers.join(", ")}`,
    opts.notesExtra ?? null,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers,
    name: opts.name,
    description: [brand, opts.name, opts.model].filter(Boolean).join(" · "),
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

/** Complete assemblies / motors — Stands as counted. */
export const hydraulicAssemblyParts: Part[] = [
  // --- Stand 12 ---
  hydraulicAssembly({
    id: "hydraulic-assy-yc35-6-swing-s12",
    partNumber: "YC35-6-SWING",
    partNumbers: ["YC35-6-SWING", "YC35-6", "YC35-6-SWING-MOTOR"],
    name: "Swing Motor Assembly — YC35-6",
    description: "Complete Hydraulic Rotary Slew Motor Unit",
    model: "YC35-6 (Yuchai Mini Excavator Series)",
    quantity: 1,
    stand: 12,
    compatibility: ["Yuchai YC35-6"],
    notesExtra:
      "Converts high-pressure hydraulic flow into rotative torque for upper-house slew",
  }),
];
