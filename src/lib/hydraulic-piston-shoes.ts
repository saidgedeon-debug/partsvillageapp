/** piston shoe subcategory seed — Hydraulic Parts (Stand 59). */
import type { Part } from "@/lib/mock-data";

type Fit = { brand: string; models: string[] };

function flatCompat(groups: Fit[]): string[] {
  const out: string[] = [];
  for (const g of groups) {
    for (const m of g.models) out.push(`${g.brand} ${m}`);
  }
  return out;
}

const handok = "Handok Hydraulic (South Korea)";

function pistonShoe(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  weightKg: number;
  ringConfig: string;
  fitment: Fit[];
}): Part {
  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: `${handok} · ${opts.name} · ${opts.ringConfig} · ~${opts.weightKg} kg`,
    category: "Hydraulic Parts",
    subcategory: "piston shoe",
    boxNumber: 59,
    quantity: opts.quantity,
    reorderAt: Math.max(1, Math.min(2, Math.floor(opts.quantity / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: flatCompat(opts.fitment),
    notes: `Subcategory: piston shoe · Stand 59 · Manufacturer: ${handok} · Weight: ~${opts.weightKg} kg · Rings: ${opts.ringConfig} · OEM xref: ${opts.partNumbers.join(", ")}`,
  };
}

/** Stand 59 Handok KMF125 piston shoes */
export const pistonShoeParts: Part[] = [
  pistonShoe({
    id: "hydraulic-piston-shoe-02524",
    partNumber: "02524",
    partNumbers: ["02524", "HD-02524", "KMF125-PS-2R"],
    name: "Handok KMF125 Piston with Two Rings (PC200-8)",
    quantity: 2,
    weightKg: 0.22,
    ringConfig: "Two Rings (Dual Slot)",
    fitment: [
      {
        brand: "Komatsu",
        models: ["PC200-8", "PC200LC-8", "PC220-8", "PC240-8"],
      },
    ],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-21623",
    partNumber: "21623",
    partNumbers: ["21623", "HD-21623", "KMF125-PS-1R"],
    name: "Handok KMF125 Piston with One Ring (PC200-7)",
    quantity: 2,
    weightKg: 0.22,
    ringConfig: "One Ring (Single Slot)",
    fitment: [
      {
        brand: "Komatsu",
        models: ["PC200-7", "PC200LC-7", "PC210-7", "PC220-7"],
      },
    ],
  }),
];
