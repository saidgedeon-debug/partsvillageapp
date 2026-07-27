/** piston shoe subcategory seed — Hydraulic Parts (Stand 59–62). */
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
  stand: 59 | 60 | 61 | 62;
  weightKg?: number;
  ringConfig?: string;
  boxSetQty?: number;
  lengthMm?: number;
  fitment: Fit[];
}): Part {
  const detailBits = [
    opts.ringConfig,
    opts.weightKg != null ? `~${opts.weightKg} kg` : null,
    opts.lengthMm != null ? `L ${opts.lengthMm} mm` : null,
    opts.boxSetQty != null ? `box set ×${opts.boxSetQty}` : null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: piston shoe`,
    `Stand ${opts.stand}`,
    `Manufacturer: ${handok}`,
    opts.weightKg != null ? `Weight: ~${opts.weightKg} kg` : null,
    opts.lengthMm != null ? `Length: ${opts.lengthMm} mm` : null,
    opts.ringConfig ? `Rings: ${opts.ringConfig}` : null,
    opts.boxSetQty != null ? `Box set qty: ${opts.boxSetQty}` : null,
    `OEM xref: ${opts.partNumbers.join(", ")}`,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: [handok, opts.name, ...detailBits].join(" · "),
    category: "Hydraulic Parts",
    subcategory: "piston shoe",
    boxNumber: opts.stand,
    quantity: opts.quantity,
    reorderAt: Math.max(1, Math.min(2, Math.floor(opts.quantity / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: flatCompat(opts.fitment),
    notes: noteBits.join(" · "),
  };
}

/** Stand 59–62 Handok piston shoes */
export const pistonShoeParts: Part[] = [
  // —— Stand 59 ——
  pistonShoe({
    id: "hydraulic-piston-shoe-02524",
    partNumber: "02524",
    partNumbers: ["02524", "HD-02524", "KMF125-PS-2R"],
    name: "Handok KMF125 Piston with Two Rings (PC200-8)",
    quantity: 2,
    stand: 59,
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
    stand: 59,
    weightKg: 0.22,
    ringConfig: "One Ring (Single Slot)",
    fitment: [
      {
        brand: "Komatsu",
        models: ["PC200-7", "PC200LC-7", "PC210-7", "PC220-7"],
      },
    ],
  }),

  // —— Stand 60 ——
  pistonShoe({
    id: "hydraulic-piston-shoe-16148",
    partNumber: "16148",
    partNumbers: ["16148", "HD-16148", "SG08-PS"],
    name: "Handok SG08 (MFB150/160) Piston Shoe (⌀ 26.5)",
    quantity: 1,
    stand: 60,
    weightKg: 0.26,
    boxSetQty: 9,
    fitment: [{ brand: "Kawasaki", models: ["SG08", "MFB150", "MFB160"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-708-1w-23310",
    partNumber: "708-1W-23310",
    partNumbers: ["708-1W-23310", "7081W23310", "HPV75-PS-OLD"],
    name: "Handok HPV75 Piston Shoe (PC60-7 Old Type - 72L)",
    quantity: 1,
    stand: 60,
    boxSetQty: 9,
    fitment: [{ brand: "Komatsu", models: ["PC60-7", "PC60-7E", "PC60-7-B"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-15837",
    partNumber: "15837",
    partNumbers: ["15837", "HD-15837", "GM35VA-PS"],
    name: "Handok GM35VA Piston Shoe (⌀ 28.0 x 97.0L)",
    quantity: 1,
    stand: 60,
    weightKg: 0.35,
    boxSetQty: 9,
    fitment: [{ brand: "Teijin Seiki / Nabtesco", models: ["GM35VA"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-708-2h-23311",
    partNumber: "708-2H-23311",
    partNumbers: ["708-2H-23311", "7082H23311", "HPV132C-PS"],
    name: "Handok HPV132C Piston Shoe (PC300-6 - ⌀ 25)",
    quantity: 2,
    stand: 60,
    boxSetQty: 9,
    fitment: [{ brand: "Komatsu", models: ["PC300-6", "PC300LC-6"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-101760",
    partNumber: "101760",
    partNumbers: ["101760", "HD-101760", "KMF41-PS"],
    name: "Handok KMF41 Piston Shoe (PC60-7 - 19.5 x 50.4L)",
    quantity: 2,
    stand: 60,
    boxSetQty: 7,
    fitment: [{ brand: "Komatsu", models: ["PC60-7", "PC70-7"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-15950",
    partNumber: "15950",
    partNumbers: ["15950", "HD-15950", "M2X210-PS"],
    name: "Handok M2X210 Piston Shoe (⌀ 30)",
    quantity: 2,
    stand: 60,
    boxSetQty: 9,
    fitment: [{ brand: "Kawasaki Swing Motors", models: ["M2X210", "M2X210B"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-00574",
    partNumber: "00574",
    partNumbers: ["00574", "HD-00574", "M2X120-PS"],
    name: "Handok M2X120 Piston Shoe (⌀ 25)",
    quantity: 3,
    stand: 60,
    weightKg: 0.24,
    boxSetQty: 9,
    fitment: [{ brand: "Kawasaki Swing Motors", models: ["M2X120", "M2X120B"] }],
  }),

  // —— Stand 61 ——
  pistonShoe({
    id: "hydraulic-piston-shoe-57466",
    partNumber: "57466",
    partNumbers: ["57466", "HD-57466", "HPV132-PS-BR"],
    name: "Handok HPV132 Piston Shoe (PC300-6 BR - ⌀ 25)",
    quantity: 4,
    stand: 61,
    weightKg: 0.31,
    boxSetQty: 9,
    fitment: [{ brand: "Komatsu", models: ["PC300-6", "PC300LC-6"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-59962",
    partNumber: "59962",
    partNumbers: ["59962", "HD-59962", "HPV140-PS-BR"],
    name: "Handok HPV140 Piston Shoe (PC300-7/8 BR - ⌀ 25.0)",
    quantity: 9,
    stand: 61,
    weightKg: 0.25,
    boxSetQty: 9,
    lengthMm: 88.3,
    fitment: [
      {
        brand: "Komatsu",
        models: ["PC300-7", "PC300LC-7", "PC300-8", "PC300LC-8"],
      },
    ],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-16251",
    partNumber: "16251",
    partNumbers: ["16251", "HD-16251", "A8V86-PS-1R"],
    name: "Handok A8V86 Piston with One Ring (⌀ 22.8)",
    quantity: 1,
    stand: 61,
    weightKg: 0.2,
    ringConfig: "One Ring",
    boxSetQty: 7,
    fitment: [{ brand: "Rexroth", models: ["A8V86", "A8V86ESBR"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-61487",
    partNumber: "61487",
    partNumbers: ["61487", "HD-61487", "HMGF36-PS-ASSY"],
    name: "Handok HMGF36 / HMV116 Piston Assembly (⌀ 26)",
    quantity: 3,
    stand: 61,
    weightKg: 0.34,
    boxSetQty: 7,
    fitment: [{ brand: "Kawasaki", models: ["HMGF36", "HMV116"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-8059452",
    partNumber: "8059452",
    partNumbers: ["8059452", "HD-8059452", "HPVO102-PS-ASSY"],
    name: "Handok HPVO102 Piston Assembly",
    quantity: 3,
    stand: 61,
    boxSetQty: 7,
    fitment: [
      {
        brand: "Hitachi",
        models: ["EX200-2", "EX200-3", "EX220-2", "EX220-3"],
      },
    ],
  }),

  // —— Stand 62 ——
  pistonShoe({
    id: "hydraulic-piston-shoe-15707",
    partNumber: "15707",
    partNumbers: ["15707", "HD-15707", "HPV116-PS-ASSY"],
    name: "Handok HPV116 Piston Assembly (⌀ 26)",
    quantity: 11,
    stand: 62,
    weightKg: 0.34,
    boxSetQty: 7,
    fitment: [
      {
        brand: "Hitachi ZAXIS Series",
        models: ["ZX200", "ZX200-3", "ZX210-3", "ZX240-3", "ZX270-3"],
      },
    ],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-06341",
    partNumber: "06341",
    partNumbers: ["06341", "HD-06341", "KMF90-PS-EDGE"],
    name: "Handok KMF90 / PC200-3 Piston Assembly (Edge Type - ⌀ 23.5)",
    quantity: 1,
    stand: 62,
    weightKg: 0.27,
    boxSetQty: 7,
    fitment: [
      {
        brand: "Komatsu",
        models: ["PC200-3", "PC200LC-3", "PC210-3", "PC220-3"],
      },
    ],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-03094",
    partNumber: "03094",
    partNumbers: ["03094", "HD-03094", "A8V107SR1R-PS-ASSY"],
    name: "Handok A8V107SR1R Piston Assembly",
    quantity: 4,
    stand: 62,
    weightKg: 0.36,
    boxSetQty: 7,
    fitment: [{ brand: "Rexroth", models: ["A8V107SR1R"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-02637",
    partNumber: "02637",
    partNumbers: ["02637", "HD-02637", "KMF90-PS-R-OLD"],
    name: "Handok KMF90 / PC200-2 Piston Assembly with Ring (Old Type - ⌀ 23.5)",
    quantity: 1,
    stand: 62,
    weightKg: 0.27,
    ringConfig: "With Ring",
    boxSetQty: 7,
    lengthMm: 96.4,
    fitment: [{ brand: "Komatsu", models: ["PC200-2", "PC200LC-2"] }],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-15738",
    partNumber: "15738",
    partNumbers: ["15738", "HD-15738", "HPV145-PS-ASSY"],
    name: "Handok HPV145 Piston Assembly (⌀ 28)",
    quantity: 1,
    stand: 62,
    weightKg: 0.34,
    boxSetQty: 7,
    fitment: [
      {
        brand: "Hitachi ZAXIS Series",
        models: ["ZX330", "ZX330-3", "ZX350-3", "ZX350LC-5G"],
      },
    ],
  }),
  pistonShoe({
    id: "hydraulic-piston-shoe-0350291",
    partNumber: "0350291",
    partNumbers: ["0350291", "HD-0350291", "A7VO250-PS-1R"],
    name: "Handok A7VO250 Piston with One Ring",
    quantity: 3,
    stand: 62,
    ringConfig: "One Ring",
    boxSetQty: 7,
    fitment: [{ brand: "Rexroth", models: ["A7VO250", "A7VO250L", "A7VO250EL"] }],
  }),
];
