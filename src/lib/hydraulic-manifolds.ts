/** Manifolds & Blocks subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const aftermarket = "Aftermarket Premium Grade";
const sub = "Manifolds & Blocks";

export function manifold(opts: {
  id: string;
  partNumber: string;
  partNumbers?: string[];
  name: string;
  quantity: number;
  stand?: number;
  brand?: string;
  componentType?: string;
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const brand = opts.brand?.trim() || aftermarket;
  const partNumbers = opts.partNumbers?.length
    ? [...opts.partNumbers]
    : [opts.partNumber];
  const type = opts.componentType ?? "Manifold Assembly";
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    `Manufacturer: ${brand}`,
    `Type: ${type}`,
    `OEM xref: ${partNumbers.join(", ")}`,
    opts.notesExtra ?? null,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers,
    name: opts.name,
    description: [brand, opts.name, type].join(" · "),
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

/** Manifold / block stock — Stands as counted. */
export const manifoldParts: Part[] = [
  // --- Stand 10 ---
  manifold({
    id: "hydraulic-mf-mf23-assy-s10",
    partNumber: "MF23",
    partNumbers: [
      "MF23",
      "Series 20 MF23",
      "Sundstrand MF23",
      "Sauer-Danfoss MF23",
      "Frame 23",
    ],
    name: "Manifold Assy with By-Pass Valve (MF23 / Frame 23)",
    quantity: 1,
    stand: 10,
    componentType: "Manifold Assembly with By-Pass Valve",
    compatibility: [
      "Sauer-Danfoss Series 20 MF23",
      "Sundstrand Series 20 MF23",
      "Frame 23",
      "Concrete transit mixer drum drives",
      "Asphalt paving compactor drum drives",
      "Agricultural combine harvester ground systems",
    ],
    notesExtra:
      "Valving: high-pressure relief ×2, shuttle flushing ×1, charge relief ×1, manual bypass screw ×1 · Frame displacement match 42.1 cc/rev (2.57 cu in/rev) · Circuit: closed loop HST · Connection: direct face-mount bolt pattern to port plate",
  }),
];
