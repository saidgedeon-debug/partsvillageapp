/** cylinder block subcategory seed — Hydraulic Parts (Stands 44–57). */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const aftermarket = "Aftermarket Premium Grade";
const engrenax = "Engrenax (Canada)";
const sub = "cylinder block";

type Stand = 44 | 45 | 46 | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 56 | 57;

function block(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  stand: Stand;
  manufacturer?: string;
  componentType?: string;
  compatibility: string[];
  length?: string;
  orientation?: string;
  sizeParameter?: string;
  variant?: string;
  configuration?: string;
}): Part {
  const mfr = opts.manufacturer ?? handok;
  const type = opts.componentType ?? "Cylinder Block";
  const detailBits = [
    type,
    opts.length ? `L ${opts.length}` : null,
    opts.orientation ?? null,
    opts.sizeParameter != null ? `S=${opts.sizeParameter}` : null,
    opts.variant ?? null,
    opts.configuration ?? null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    `Stand ${opts.stand}`,
    `Manufacturer: ${mfr}`,
    `Type: ${type}`,
    opts.length ? `Length: ${opts.length}` : null,
    opts.orientation ? `Orientation: ${opts.orientation}` : null,
    opts.sizeParameter != null ? `Size: ${opts.sizeParameter}` : null,
    opts.variant ? `Variant: ${opts.variant}` : null,
    opts.configuration ? `Configuration: ${opts.configuration}` : null,
    `OEM xref: ${opts.partNumbers.join(", ")}`,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: [mfr, opts.name, ...detailBits].join(" · "),
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

/** Stands 44–57 cylinder blocks / barrels / rotary groups */
export const cylinderBlockParts: Part[] = [
  // —— Stand 46 ——
  block({
    id: "hydraulic-cb-43847-s46",
    partNumber: "43847",
    partNumbers: ["43847", "HD-43847"],
    name: "Cylinder Block R (HPV160 PC300/400-5)",
    quantity: 4,
    stand: 46,
    orientation: "Right",
    compatibility: ["Komatsu PC300-5", "Komatsu PC400-5", "HPV160"],
  }),

  // —— Stand 45 ——
  block({
    id: "hydraulic-cb-05128-s45",
    partNumber: "05128",
    partNumbers: ["05128", "HD-05128"],
    name: "Cylinder Block (M2X210 S=17.4)",
    quantity: 4,
    stand: 45,
    sizeParameter: "17.4",
    compatibility: ["Kawasaki M2X210"],
  }),

  // —— Stand 44 ——
  block({
    id: "hydraulic-cb-43847-s44",
    partNumber: "43847",
    partNumbers: ["43847", "HD-43847"],
    name: "Cylinder Block R (HPV160 PC300/400-5 B)",
    quantity: 4,
    stand: 44,
    orientation: "Right",
    variant: "B",
    compatibility: ["Komatsu PC300-5", "Komatsu PC400-5", "HPV160"],
  }),

  // —— Stand 57 ——
  block({
    id: "hydraulic-cb-63854",
    partNumber: "63854",
    partNumbers: ["63854", "HD-63854"],
    name: "Cylinder Block L=73 (KMF125 PC200-8)",
    quantity: 5,
    stand: 57,
    length: "73mm",
    compatibility: ["Komatsu PC200-8", "KMF125"],
  }),
  block({
    id: "hydraulic-cb-01758",
    partNumber: "01758",
    partNumbers: ["01758", "HD-01758"],
    name: "Cylinder Block (KMF41 PC60-7)",
    quantity: 2,
    stand: 57,
    compatibility: ["Komatsu PC60-7", "KMF41"],
  }),
  block({
    id: "hydraulic-cb-61278",
    partNumber: "61278",
    partNumbers: ["61278", "HD-61278"],
    name: "Cylinder Block L=68 (KMF125 PC200-7)",
    quantity: 2,
    stand: 57,
    length: "68mm",
    compatibility: ["Komatsu PC200-7", "KMF125"],
  }),
  block({
    id: "hydraulic-cb-05029",
    partNumber: "05029",
    partNumbers: ["05029", "HD-05029"],
    name: "Cylinder Block (A8V86)",
    quantity: 1,
    stand: 57,
    compatibility: ["Rexroth A8V86"],
  }),
  block({
    id: "hydraulic-cb-39666",
    partNumber: "39666",
    partNumbers: ["39666", "HD-39666"],
    name: "Cylinder Block (A8V107)",
    quantity: 1,
    stand: 57,
    compatibility: ["Rexroth A8V107"],
  }),

  // —— Stand 56 ——
  block({
    id: "hydraulic-cb-05265-s56",
    partNumber: "05265",
    partNumbers: ["05265", "HD-05265"],
    name: "Cylinder Block L (HPV90 PC200-3 BM)",
    quantity: 1,
    stand: 56,
    orientation: "Left",
    compatibility: ["Komatsu PC200-3", "HPV90"],
  }),
  block({
    id: "hydraulic-cb-05340",
    partNumber: "05340",
    partNumbers: ["05340", "HD-05340"],
    name: "Cylinder Block R (HPV90 PC200-3)",
    quantity: 1,
    stand: 56,
    orientation: "Right",
    compatibility: ["Komatsu PC200-3", "HPV90"],
  }),
  block({
    id: "hydraulic-cb-05333",
    partNumber: "05333",
    partNumbers: ["05333", "HD-05333"],
    name: "Cylinder Block (M2X120 S=16.3)",
    quantity: 6,
    stand: 56,
    sizeParameter: "16.3",
    compatibility: ["Kawasaki M2X120"],
  }),

  // —— Stand 54 ——
  block({
    id: "hydraulic-cb-46145",
    partNumber: "46145",
    partNumbers: ["46145", "708-2T-00441", "7082T00441", "HD-46145"],
    name: "Cylinder Block L (HPV160 PC300/400-5)",
    quantity: 4,
    stand: 54,
    orientation: "Left",
    compatibility: ["Komatsu PC300-5", "Komatsu PC400-5", "HPV160"],
  }),

  // —— Stand 53 ——
  block({
    id: "hydraulic-cb-60094",
    partNumber: "60094",
    partNumbers: ["60094", "HD-60094"],
    name: "Cylinder Block R (H5V200DTH B)",
    quantity: 1,
    stand: 53,
    orientation: "Right",
    compatibility: ["Hitachi H5V200DTH"],
  }),
  block({
    id: "hydraulic-cb-708-2t-00441",
    partNumber: "708-2T-00441",
    partNumbers: ["708-2T-00441", "7082T00441"],
    name: "Cylinder Block L (HPV160 PC300-5/400-5 Alt)",
    quantity: 2,
    stand: 53,
    orientation: "Left",
    compatibility: ["Komatsu PC300-5", "Komatsu PC400-5", "HPV160"],
  }),
  block({
    id: "hydraulic-cb-05128-s53",
    partNumber: "05128",
    partNumbers: ["05128", "HD-05128"],
    name: "Cylinder Block (M2X210 S=17.4)",
    quantity: 1,
    stand: 53,
    sizeParameter: "17.4",
    compatibility: ["Kawasaki M2X210"],
  }),

  // —— Stand 52 ——
  block({
    id: "hydraulic-cb-708-25-00400",
    partNumber: "708-25-00400",
    partNumbers: ["708-25-00400", "7082500400"],
    name: "Cylinder Block L (HPV90 PC200-5)",
    quantity: 1,
    stand: 52,
    orientation: "Left",
    compatibility: ["Komatsu PC200-5", "HPV90"],
  }),
  block({
    id: "hydraulic-cb-706-75-41091",
    partNumber: "706-75-41091",
    partNumbers: ["706-75-41091", "7067541091"],
    name: "Cylinder Block (KMF90 PC200-3/5)",
    quantity: 2,
    stand: 52,
    compatibility: ["Komatsu PC200-3", "Komatsu PC200-5", "KMF90"],
  }),
  block({
    id: "hydraulic-cb-708-25-00410",
    partNumber: "708-25-00410",
    partNumbers: ["708-25-00410", "7082500410"],
    name: "Cylinder Block R (HPV90 PC200-5)",
    quantity: 1,
    stand: 52,
    orientation: "Right",
    compatibility: ["Komatsu PC200-5", "HPV90"],
  }),
  block({
    id: "hydraulic-cb-pvk-2b-505",
    partNumber: "PVK-2B-505",
    partNumbers: ["PVK-2B-505", "PVK2B505"],
    name: "Cylinder Block (PVK-2B-505)",
    quantity: 1,
    stand: 52,
    manufacturer: aftermarket,
    compatibility: ["Nachi PVK-2B-505"],
  }),
  block({
    id: "hydraulic-cb-ap2d18",
    partNumber: "AP2D18",
    partNumbers: ["AP2D18"],
    name: "Rotary Group (AP2D18)",
    quantity: 1,
    stand: 52,
    manufacturer: aftermarket,
    componentType: "Rotary Group Assembly",
    compatibility: ["Uchida AP2D18"],
  }),

  // —— Stand 51 ——
  block({
    id: "hydraulic-cb-200057",
    partNumber: "200057",
    partNumbers: ["200057", "51-8631", "518631"],
    name: "Barrel 1 pc. (GM35VA / 51-8631)",
    quantity: 1,
    stand: 51,
    manufacturer: engrenax,
    componentType: "Barrel",
    compatibility: ["Teijin Seiki GM35VA"],
  }),
  block({
    id: "hydraulic-cb-100217",
    partNumber: "100217",
    partNumbers: ["100217"],
    name: "Cylinder Block (M2X120)",
    quantity: 4,
    stand: 51,
    manufacturer: engrenax,
    compatibility: ["Kawasaki M2X120"],
  }),
  block({
    id: "hydraulic-cb-465964",
    partNumber: "465964",
    partNumbers: ["465964", "HD-465964"],
    name: "Cylinder Block (AP2D-36)",
    quantity: 1,
    stand: 51,
    compatibility: ["Uchida AP2D-36", "Uchida AP2D36"],
  }),
  block({
    id: "hydraulic-cb-60095",
    partNumber: "60095",
    partNumbers: ["60095", "HD-60095"],
    name: "Cylinder Block L (H5V200DTH B)",
    quantity: 1,
    stand: 51,
    orientation: "Left",
    compatibility: ["Hitachi H5V200DTH"],
  }),
  block({
    id: "hydraulic-cb-0365406",
    partNumber: "0365406",
    partNumbers: ["0365406", "HD-0365406"],
    name: "Cylinder Block (M2X210)",
    quantity: 1,
    stand: 51,
    compatibility: ["Kawasaki M2X210"],
  }),

  // —— Stand 50 ——
  block({
    id: "hydraulic-cb-63465",
    partNumber: "63465",
    partNumbers: ["63465", "HD-63465"],
    name: "Cylinder Block R (HPV140 PC300-7/8 BM)",
    quantity: 2,
    stand: 50,
    orientation: "Right",
    compatibility: ["Komatsu PC300-7", "Komatsu PC300-8", "HPV140"],
  }),
  block({
    id: "hydraulic-cb-32681",
    partNumber: "32681",
    partNumbers: ["32681", "HD-32681"],
    name: "Cylinder Block L (HPV160 PC300/400-3)",
    quantity: 2,
    stand: 50,
    orientation: "Left",
    compatibility: ["Komatsu PC300-3", "Komatsu PC400-3", "HPV160"],
  }),

  // —— Stand 49 ——
  block({
    id: "hydraulic-cb-2032256",
    partNumber: "2032256",
    partNumbers: ["2032256", "HD-2032256"],
    name: "Cylinder Block (HMF35 HMV116GF=EX200)",
    quantity: 2,
    stand: 49,
    compatibility: ["Hitachi EX200", "HMF35", "HMV116GF"],
  }),
  block({
    id: "hydraulic-cb-0350306",
    partNumber: "0350306",
    partNumbers: ["0350306", "HD-0350306"],
    name: "Cylinder Block (A7VO250)",
    quantity: 1,
    stand: 49,
    compatibility: ["Rexroth A7VO250"],
  }),
  block({
    id: "hydraulic-cb-708-25-00020",
    partNumber: "708-25-00020",
    partNumbers: ["708-25-00020", "7082500020"],
    name: "Cylinder Block R (HPV90 PC200-3)",
    quantity: 1,
    stand: 49,
    orientation: "Right",
    compatibility: ["Komatsu PC200-3", "HPV90"],
  }),
  block({
    id: "hydraulic-cb-61385",
    partNumber: "61385",
    partNumbers: ["61385", "HD-61385"],
    name: "Cylinder Block (HPV75 PC60-7=NEW)",
    quantity: 1,
    stand: 49,
    variant: "NEW",
    compatibility: ["Komatsu PC60-7", "HPV75"],
  }),
  block({
    id: "hydraulic-cb-708-25-00010",
    partNumber: "708-25-00010",
    partNumbers: ["708-25-00010", "7082500010"],
    name: "Cylinder Block L (HPV90 PC200-3)",
    quantity: 1,
    stand: 49,
    orientation: "Left",
    compatibility: ["Komatsu PC200-3", "HPV90"],
  }),

  // —— Stand 48 ——
  block({
    id: "hydraulic-cb-05098",
    partNumber: "05098",
    partNumbers: ["05098", "HD-05098"],
    name: "Cylinder Block (A7VO250L/EL)",
    quantity: 2,
    stand: 48,
    configuration: "L/EL",
    compatibility: ["Rexroth A7VO250L", "Rexroth A7VO250EL"],
  }),
  block({
    id: "hydraulic-cb-05265-s48",
    partNumber: "05265",
    partNumbers: ["05265", "HD-05265"],
    name: "Cylinder Block L (HPV90 PC200-3 B)",
    quantity: 1,
    stand: 48,
    orientation: "Left",
    compatibility: ["Komatsu PC200-3", "HPV90"],
  }),
  block({
    id: "hydraulic-cb-09683",
    partNumber: "09683",
    partNumbers: ["09683", "HD-09683"],
    name: "Cylinder Block (M2X150 S=18)",
    quantity: 2,
    stand: 48,
    sizeParameter: "18",
    compatibility: ["Kawasaki M2X150"],
  }),
  block({
    id: "hydraulic-cb-31851",
    partNumber: "31851",
    partNumbers: ["31851", "HD-31851"],
    name: "Cylinder Block (A8V107SR1R)",
    quantity: 4,
    stand: 48,
    configuration: "SR1R",
    compatibility: ["Rexroth A8V107SR1R"],
  }),
];
