/** servo piston subcategory seed — Hydraulic Parts (Stand 25). */
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

function servo(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  weightKg: number;
  pumpSeries: string[];
  fitment: Fit[];
}): Part {
  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: `${handok} · ${opts.name} · ~${opts.weightKg} kg`,
    category: "Hydraulic Parts",
    subcategory: "servo piston",
    boxNumber: 25,
    quantity: opts.quantity,
    reorderAt: Math.max(1, Math.min(2, Math.floor(opts.quantity / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: flatCompat(opts.fitment),
    notes: `Subcategory: servo piston · Stand 25 · Manufacturer: ${handok} · Weight: ~${opts.weightKg} kg · Pump series: ${opts.pumpSeries.join("; ")} · OEM xref: ${opts.partNumbers.join(", ")}`,
  };
}

export const servoPistonParts: Part[] = [
  servo({
    id: "hydraulic-servo-3069541",
    partNumber: "3069541",
    partNumbers: ["3069541", "HD-3069541", "HPVO102-SERVO"],
    name: "Handok HPVO102 Servo Piston",
    quantity: 2,
    weightKg: 0.84,
    pumpSeries: ["Hitachi HPVO102 Series Regular Flow Group"],
    fitment: [
      { brand: "Hitachi", models: ["EX200-2", "EX200-3", "EX220-2", "EX220-3"] },
    ],
  }),
  servo({
    id: "hydraulic-servo-37730",
    partNumber: "37730",
    partNumbers: ["37730", "HD-37730", "HPV116-SERVO", "9194210"],
    name: "Handok HPV116 Servo Piston",
    quantity: 9,
    weightKg: 0.84,
    pumpSeries: ["Hitachi / Kawasaki HPV116 Series Drives"],
    fitment: [
      {
        brand: "Hitachi",
        models: ["ZX200", "ZX200-3", "ZX210-3", "ZX240-3", "ZX270-3"],
      },
      { brand: "John Deere", models: ["200CLC", "240D", "270CLC"] },
    ],
  }),
  servo({
    id: "hydraulic-servo-18210",
    partNumber: "18210",
    partNumbers: ["18210", "HD-18210", "H3V140-SERVO", "H3V180DT-SERVO"],
    name: "Handok H3V140 / 180DT Servo Piston",
    quantity: 2,
    weightKg: 0.99,
    pumpSeries: [
      "Handok / Kawasaki H3V140 Series",
      "H3V180DT Series Type",
    ],
    fitment: [
      { brand: "Kobelco", models: ["SK330", "SK330-6", "SK350", "SK350-8"] },
      { brand: "Hyundai", models: ["R320LC-7", "R320LC-9", "R360LC-7"] },
      { brand: "Volvo", models: ["EC360B", "EC360C"] },
    ],
  }),
];
