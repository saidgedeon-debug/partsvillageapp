/** retainer / set plate subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

type Fit = { brand: string; models: string[] };

function flatCompat(groups: Fit[]): string[] {
  const out: string[] = [];
  for (const g of groups) {
    for (const m of g.models) out.push(`${g.brand} ${m}`);
  }
  return out;
}

function sp(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  manufacturer: string;
  boxNumber: 12 | 26 | 27 | 58;
  location: "Stand 12" | "Stand 26" | "Stand 27" | "Stand 58";
  fitment: Fit[];
  reorderAt?: number;
  componentType?: string;
}): Part {
  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: `${opts.manufacturer} · ${opts.name}`,
    category: "Hydraulic Parts",
    subcategory: "retainer / set plate",
    boxNumber: opts.boxNumber,
    quantity: opts.quantity,
    reorderAt:
      opts.reorderAt ?? Math.max(1, Math.min(2, Math.floor(opts.quantity / 2) || 1)),
    cost: 0,
    price: 0,
    compatibility: flatCompat(opts.fitment),
    notes: [
      `Subcategory: retainer / set plate`,
      opts.location,
      `Manufacturer: ${opts.manufacturer}`,
      opts.componentType ? `Type: ${opts.componentType}` : null,
      `OEM xref: ${opts.partNumbers.join(", ")}`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

const handok = "Handok Hydraulic (South Korea)";
const engrenax = "Engrenax (Canada)";
const aftermarket = "Aftermarket Premium Grade";

/** Retainer / set plates — Stands as counted. */
export const retainerSetPlateParts: Part[] = [
  // —— Stand 12 ——
  sp({
    id: "hydraulic-sp-ap2d36-s12",
    partNumber: "AP2D36-SP",
    partNumbers: ["AP2D36-SP", "AP2D36", "AP2D36-SET-PLATE"],
    name: "Retainer Plate (Set Plate) — AP2D36",
    quantity: 1,
    manufacturer: aftermarket,
    boxNumber: 12,
    location: "Stand 12",
    componentType: "Piston Shoe Retainer Guide Face",
    fitment: [
      { brand: "Uchida", models: ["AP2D36"] },
      { brand: "Rexroth", models: ["AP2D36"] },
      { brand: "Takeuchi", models: ["TB135", "TB138FR", "TB145"] },
      { brand: "Yanmar", models: ["Vio35", "Vio35-3", "Vio35-5"] },
      { brand: "Kubota", models: ["KX91-3", "KX101-3"] },
      { brand: "Komatsu", models: ["PC30MR", "PC35MR"] },
    ],
  }),
  sp({
    id: "hydraulic-sp-ap2d25-s12",
    partNumber: "AP2D25-SP",
    partNumbers: ["AP2D25-SP", "AP2D25", "AP2D25-SET-PLATE"],
    name: "Retainer Plate (Set Plate) — AP2D25",
    quantity: 1,
    manufacturer: aftermarket,
    boxNumber: 12,
    location: "Stand 12",
    componentType: "Piston Shoe Retainer Guide Face",
    fitment: [
      { brand: "Uchida", models: ["AP2D25"] },
      { brand: "Rexroth", models: ["AP2D25"] },
      { brand: "Takeuchi", models: ["TB025", "TB125"] },
      { brand: "Yanmar", models: ["Vio25", "Vio25-2", "Vio27"] },
      { brand: "Kubota", models: ["KX61-2", "KX71-3"] },
      { brand: "Komatsu", models: ["PC25R-8", "PC27MR"] },
    ],
  }),

  // —— Stand 27 ——
  sp({
    id: "hydraulic-sp-a7vo250-flat-hd",
    partNumber: "A7VO250-SP-FLAT-HD",
    partNumbers: ["A7VO250-SP-FLAT-HD", "A7VO250-SP-FLAT", "HD-A7VO250-SP-OLD"],
    name: "Handok A7VO250 Retainer / Set Plate (Flat Type - Old Type)",
    quantity: 2,
    manufacturer: handok,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Rexroth", models: ["A7VO250", "A7VO250L", "A7VO250EL"] }],
  }),
  sp({
    id: "hydraulic-sp-a8vo107-eg",
    partNumber: "A8VO107-SP-EG",
    partNumbers: ["A8VO107-SP-EG", "A8VO107-SP", "EG-A8VO107-SP"],
    name: "Engrenax A8VO107 Retainer / Set Plate",
    quantity: 11,
    manufacturer: engrenax,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Rexroth", models: ["A8VO107", "A8VO107LA1HN1"] }],
  }),
  sp({
    id: "hydraulic-sp-m2x120-eg",
    partNumber: "M2X120-SP-EG",
    partNumbers: ["M2X120-SP-EG", "M2X120-SP", "EG-M2X120-SP"],
    name: "Engrenax M2X120 Retainer / Set Plate",
    quantity: 8,
    manufacturer: engrenax,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Kawasaki", models: ["M2X120", "M2X120B"] }],
  }),
  sp({
    id: "hydraulic-sp-m2x150-170-eg",
    partNumber: "M2X150-170-SP-EG",
    partNumbers: ["M2X150-170-SP-EG", "M2X150-SP", "M2X170-SP", "EG-M2X150-170-SP"],
    name: "Engrenax M2X150/170 Retainer / Set Plate",
    quantity: 3,
    manufacturer: engrenax,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Kawasaki", models: ["M2X150", "M2X170", "M2X170B"] }],
  }),
  sp({
    id: "hydraulic-sp-a8vo160-eg",
    partNumber: "A8VO160-SP-EG",
    partNumbers: ["A8VO160-SP-EG", "A8VO160-SP", "EG-A8VO160-SP"],
    name: "Engrenax A8VO160 Retainer / Set Plate",
    quantity: 6,
    manufacturer: engrenax,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Rexroth", models: ["A8VO160", "A8VO160LA1HN1"] }],
  }),
  sp({
    id: "hydraulic-sp-a7vo250-hd",
    partNumber: "A7VO250-SP-HD",
    partNumbers: ["A7VO250-SP-HD", "A7VO250-SP", "HD-A7VO250-SP"],
    name: "Handok A7VO250 Retainer / Set Plate",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Rexroth", models: ["A7VO250"] }],
  }),
  sp({
    id: "hydraulic-sp-a8v86-hd",
    partNumber: "A8V86-SP-HD",
    partNumbers: ["A8V86-SP-HD", "A8V86-SP", "HD-A8V86-SP"],
    name: "Handok A8V86 Retainer / Set Plate",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Rexroth", models: ["A8V86", "A8V86ESBR"] }],
  }),
  sp({
    id: "hydraulic-sp-kmf90-pc200-3-taper-hd",
    partNumber: "KMF90-SP-PC200-3-TAPER-HD",
    partNumbers: [
      "KMF90-SP-PC200-3-TAPER-HD",
      "706-74-11110",
      "7067411110",
      "HD-KMF90-SP-TAPER",
    ],
    name: "Handok KMF90 Retainer / Set Plate (Taper Type - PC200-3)",
    quantity: 7,
    manufacturer: handok,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [
      { brand: "Komatsu", models: ["PC200-3", "PC200LC-3", "PC210-3", "PC220-3"] },
    ],
  }),
  sp({
    id: "hydraulic-sp-a7vo250-old-hd",
    partNumber: "A7VO250-SP-OLD-HD",
    partNumbers: ["A7VO250-SP-OLD-HD", "HD-A7VO250-SP-OLD-STD"],
    name: "Handok A7VO250 Retainer / Set Plate (Standard - Old Type)",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Rexroth", models: ["A7VO250"] }],
  }),
  sp({
    id: "hydraulic-sp-a8v107sr1r-hd",
    partNumber: "A8V107SR1R-SP-HD",
    partNumbers: ["A8V107SR1R-SP-HD", "HD-A8V107SR1R-SP"],
    name: "Handok A8V107SR1R Retainer / Set Plate",
    quantity: 4,
    manufacturer: handok,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Rexroth", models: ["A8V107SR1R"] }],
  }),
  sp({
    id: "hydraulic-sp-kmf125-7h-hd",
    partNumber: "KMF125-SP-7H-HD",
    partNumbers: ["KMF125-SP-7H-HD", "706-75-11110", "7067511110", "HD-KMF125-SP-7H"],
    name: "Handok KMF125 Retainer / Set Plate (7 Holes)",
    quantity: 2,
    manufacturer: handok,
    boxNumber: 27,
    location: "Stand 27",
    fitment: [{ brand: "Komatsu", models: ["PC300-5", "PC300-6", "PC350-6"] }],
  }),

  // —— Stand 26 ——
  sp({
    id: "hydraulic-sp-m2x210-hd",
    partNumber: "M2X210-SP-HD",
    partNumbers: ["M2X210-SP-HD", "M2X210-SP", "HD-M2X210-SP"],
    name: "Handok M2X210 Retainer / Set Plate",
    quantity: 5,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Kawasaki", models: ["M2X210", "M2X210B"] }],
  }),
  sp({
    id: "hydraulic-sp-ap2d12-hd",
    partNumber: "AP2D12-SP-HD",
    partNumbers: ["AP2D12-SP-HD", "AP2D12-SP", "HD-AP2D12-SP"],
    name: "Handok AP2D12 Retainer / Set Plate",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [
      { brand: "Uchida", models: ["AP2D12", "AP2D12LV"] },
      { brand: "Rexroth", models: ["AP2D12", "AP2D12LV"] },
    ],
  }),
  sp({
    id: "hydraulic-sp-hpv160-hd",
    partNumber: "HPV160-SP-HD",
    partNumbers: ["HPV160-SP-HD", "HD-HPV160-SP"],
    name: "Handok HPV160 Retainer / Set Plate",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Komatsu", models: ["HPV160 Series"] }],
  }),
  sp({
    id: "hydraulic-sp-m2x150-170-hd",
    partNumber: "M2X150-170-SP-HD",
    partNumbers: ["M2X150-170-SP-HD", "M2X150-SP", "M2X170-SP", "HD-M2X150-170-SP"],
    name: "Handok M2X150/170 Retainer / Set Plate",
    quantity: 2,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Kawasaki", models: ["M2X150", "M2X170"] }],
  }),
  sp({
    id: "hydraulic-sp-hpv90-pc200-3-5-hd",
    partNumber: "HPV90-SP-PC200-3-5-HD",
    partNumbers: [
      "HPV90-SP-PC200-3-5-HD",
      "708-2H-11210",
      "7082H11210",
      "HD-HPV90-SP",
    ],
    name: "Handok HPV90 Retainer / Set Plate (PC200-3/5)",
    quantity: 5,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [
      { brand: "Komatsu", models: ["PC200-3", "PC200-5", "PC220-3", "PC220-5"] },
    ],
  }),
  sp({
    id: "hydraulic-sp-hpv132c-pc300-6-hd",
    partNumber: "HPV132C-SP-PC300-6-HD",
    partNumbers: ["HPV132C-SP-PC300-6-HD", "HD-HPV132C-SP"],
    name: "Handok HPV132C Retainer / Set Plate (PC300-6)",
    quantity: 4,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Komatsu", models: ["PC300-6", "PC300LC-6"] }],
  }),
  sp({
    id: "hydraulic-sp-hpv132-new-pc300-6-hd",
    partNumber: "HPV132-SP-NEW-PC300-6-HD",
    partNumbers: [
      "HPV132-SP-NEW-PC300-6-HD",
      "708-2H-11240",
      "7082H11240",
      "HD-HPV132-SP-NEW",
    ],
    name: "Handok HPV132 Retainer / Set Plate (New Type - PC300-6)",
    quantity: 2,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Komatsu", models: ["PC300-6", "PC350-6"] }],
  }),
  sp({
    id: "hydraulic-sp-hpv160-pc300-400-3-5-hd",
    partNumber: "HPV160-SP-PC300-400-3-5-HD",
    partNumbers: [
      "HPV160-SP-PC300-400-3-5-HD",
      "708-2L-11210",
      "7082L11210",
      "HD-HPV160-SP-3-5",
    ],
    name: "Handok HPV160 Retainer / Set Plate (PC300/400-3/5)",
    quantity: 8,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [
      {
        brand: "Komatsu",
        models: ["PC300-3", "PC300-5", "PC400-3", "PC400-5"],
      },
    ],
  }),
  sp({
    id: "hydraulic-sp-sg08-hd",
    partNumber: "SG08-SP-HD",
    partNumbers: ["SG08-SP-HD", "SG08-SP", "HD-SG08-SP"],
    name: "Handok SG08 Retainer / Set Plate",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Kawasaki", models: ["SG08"] }],
  }),
  sp({
    id: "hydraulic-sp-m2x120-hd",
    partNumber: "M2X120-SP-HD",
    partNumbers: ["M2X120-SP-HD", "M2X120-SP", "HD-M2X120-SP"],
    name: "Handok M2X120 Retainer / Set Plate",
    quantity: 3,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Kawasaki", models: ["M2X120", "M2X120B"] }],
  }),
  sp({
    id: "hydraulic-sp-kmf41-hd",
    partNumber: "KMF41-SP-HD",
    partNumbers: ["KMF41-SP-HD", "706-73-11110", "7067311110", "HD-KMF41-SP"],
    name: "Handok KMF41 Retainer / Set Plate",
    quantity: 2,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Komatsu", models: ["PC60-7", "PC70-7"] }],
  }),
  sp({
    id: "hydraulic-sp-hpv75-new-pc60-6-7-8-hd",
    partNumber: "HPV75-SP-NEW-PC60-6-7-8-HD",
    partNumbers: [
      "HPV75-SP-NEW-PC60-6-7-8-HD",
      "708-2G-11220",
      "7082G11220",
      "HD-HPV75-SP-NEW",
    ],
    name: "Handok HPV75 Retainer / Set Plate (New Type - PC60-6/7/8)",
    quantity: 2,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Komatsu", models: ["PC60-6", "PC60-7", "PC60-8"] }],
  }),
  sp({
    id: "hydraulic-sp-hpv95a-pc200-7-hd",
    partNumber: "HPV95A-SP-PC200-7-HD",
    partNumbers: [
      "HPV95A-SP-PC200-7-HD",
      "708-2G-11240",
      "7082G11240",
      "HD-HPV95A-SP",
    ],
    name: "Handok HPV95A Retainer / Set Plate (PC200-7)",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Komatsu", models: ["PC200-7", "PC220-7"] }],
  }),
  sp({
    id: "hydraulic-sp-hpv140-pc300-7-8-hd",
    partNumber: "HPV140-SP-PC300-7-8-HD",
    partNumbers: [
      "HPV140-SP-PC300-7-8-HD",
      "708-2L-11230",
      "7082L11230",
      "HD-HPV140-SP",
    ],
    name: "Handok HPV140 Retainer / Set Plate (PC300-7/8)",
    quantity: 1,
    manufacturer: handok,
    boxNumber: 26,
    location: "Stand 26",
    fitment: [{ brand: "Komatsu", models: ["PC300-7", "PC300-8"] }],
  }),
  // —— Stand 58 ——
  sp({
    id: "hydraulic-sp-06088",
    partNumber: "06088",
    partNumbers: ["06088", "HD-06088"],
    name: "Fix Plate of Set Plate (HPV90/70)",
    quantity: 15,
    manufacturer: handok,
    boxNumber: 58,
    location: "Stand 58",
    componentType: "Fix Plate",
    fitment: [
      { brand: "Komatsu", models: ["HPV90", "HPV70"] },
    ],
  }),
];
