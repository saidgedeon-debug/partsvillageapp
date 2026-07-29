/** Bearings catalog seed — Parts Village (Stands 75–78). */
import type { Part } from "@/lib/mock-data";
import { BEARING_SUBCATEGORIES } from "@/lib/bearings-subcategories";

export { BEARING_SUBCATEGORIES };

type BearingRow = {
  stand: 75 | 76 | 77 | 78;
  code: string;
  type: string;
  sizeMm: string;
  qty: number;
  /** Optional display suffix for name/notes (e.g. brand). */
  brandNote?: string;
};

function slug(code: string) {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function bearing(opts: BearingRow): Part {
  const sizeLabel = opts.sizeMm.replace(/x/gi, "×");
  const brand = opts.brandNote?.trim();
  const name = brand ? `${opts.code} (${brand})` : opts.code;
  const partNumbers = [opts.code];
  if (opts.code.includes("/")) {
    for (const piece of opts.code.split("/")) {
      const t = piece.trim();
      if (t && !partNumbers.includes(t)) partNumbers.push(t);
    }
  }

  return {
    id: `bearing-s${opts.stand}-${slug(opts.code)}`,
    partNumber: opts.code,
    partNumbers,
    name,
    description: `${opts.type} · ${sizeLabel} mm`,
    category: "Bearings",
    subcategory: opts.type,
    boxNumber: opts.stand,
    quantity: opts.qty,
    reorderAt: Math.max(1, Math.min(2, Math.floor(opts.qty / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: [],
    notes: [
      `Subcategory: ${opts.type}`,
      `Stand ${opts.stand}`,
      `Size: ${sizeLabel} mm`,
      brand ? `Brand: ${brand}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

const rows: BearingRow[] = [
  // —— Stand 75 ——
  { stand: 75, code: "4T-32012U", type: "Tapered Roller", sizeMm: "60x95x23", qty: 3 },
  { stand: 75, code: "NUP311EM", type: "Cylindrical Roller", sizeMm: "55x120x29", qty: 4 },
  { stand: 75, code: "NUP307EM", type: "Cylindrical Roller", sizeMm: "35x80x21", qty: 8 },
  { stand: 75, code: "NUP308EM", type: "Cylindrical Roller", sizeMm: "40x90x23", qty: 9 },
  { stand: 75, code: "4T-30211U", type: "Tapered Roller", sizeMm: "55x100x22.75", qty: 2 },
  { stand: 75, code: "6213 CM", type: "Deep Groove Ball", sizeMm: "65x120x23", qty: 1 },
  { stand: 75, code: "NUP2209ET", type: "Cylindrical Roller", sizeMm: "45x85x23", qty: 17 },

  // —— Stand 76 ——
  { stand: 76, code: "JW6049", type: "Tapered Roller", sizeMm: "60x125x37", qty: 12 },
  { stand: 76, code: "JW510", type: "Tapered Roller", sizeMm: "50x90x28", qty: 7 },
  { stand: 76, code: "4T-30213U", type: "Tapered Roller", sizeMm: "65x120x24.75", qty: 3 },
  { stand: 76, code: "NUP312EM", type: "Cylindrical Roller", sizeMm: "60x130x31", qty: 3 },
  { stand: 76, code: "31312", type: "Tapered Roller", sizeMm: "60x130x33.5", qty: 2 },
  { stand: 76, code: "31314", type: "Tapered Roller", sizeMm: "70x150x38", qty: 3 },
  { stand: 76, code: "RNA69/32", type: "Needle Roller (Double)", sizeMm: "40x52x36", qty: 12 },
  { stand: 76, code: "NA6906", type: "Needle Roller (Double)", sizeMm: "30x47x30", qty: 13 },

  // —— Stand 77 ——
  { stand: 77, code: "NUP306EM", type: "Cylindrical Roller", sizeMm: "30x72x19", qty: 5 },
  { stand: 77, code: "NUP305EM", type: "Cylindrical Roller", sizeMm: "25x62x17", qty: 3 },
  { stand: 77, code: "NUP310ET", type: "Cylindrical Roller", sizeMm: "50x110x27", qty: 4 },
  {
    stand: 77,
    code: "JW5549/JW5510",
    type: "Tapered Roller Set",
    sizeMm: "55x115x34",
    qty: 1,
  },
  { stand: 77, code: "6014 CM", type: "Deep Groove Ball", sizeMm: "70x110x20", qty: 1 },
  {
    stand: 77,
    code: "NJ2212/NJ2212V1",
    type: "Cylindrical Roller",
    sizeMm: "60x110x28",
    qty: 4,
  },
  {
    stand: 77,
    code: "NJ2212",
    type: "Cylindrical Roller",
    sizeMm: "60x110x28",
    qty: 4,
    brandNote: "NTN",
  },

  // —— Stand 78 ——
  { stand: 78, code: "22319EAS.M", type: "Spherical Roller", sizeMm: "95x200x67", qty: 2 },
  { stand: 78, code: "22226EAE4 C3", type: "Spherical Roller", sizeMm: "130x230x64", qty: 4 },
  { stand: 78, code: "NUP308ET", type: "Cylindrical Roller", sizeMm: "40x90x23", qty: 1 },
  { stand: 78, code: "22219CDE4", type: "Spherical Roller", sizeMm: "95x170x43", qty: 6 },
  { stand: 78, code: "23024CDE4", type: "Spherical Roller", sizeMm: "120x180x46", qty: 4 },
  { stand: 78, code: "30213", type: "Tapered Roller", sizeMm: "65x120x24.75", qty: 2 },
];

export const bearingParts: Part[] = rows.map(bearing);
