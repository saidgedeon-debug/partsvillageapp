/** misc subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "misc";

export function hydraulicMisc(opts: {
  id: string;
  partNumber: string;
  partNumbers?: string[];
  name?: string;
  description?: string;
  quantity: number;
  stand?: number;
  model?: string;
  brand?: string;
  origin?: string;
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const partNumbers = opts.partNumbers?.length
    ? [...opts.partNumbers]
    : [opts.partNumber];
  if (opts.model?.trim()) {
    const m = opts.model.trim();
    if (!partNumbers.some((p) => p.toLowerCase() === m.toLowerCase())) {
      partNumbers.push(m);
    }
  }
  const brand = opts.brand?.trim() || handok;
  const name =
    opts.name?.trim() ||
    opts.description?.trim() ||
    `Hydraulic Misc ${opts.partNumber}`;
  const detailBits = [
    opts.model ?? null,
    opts.description ?? null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    `Manufacturer: ${brand}`,
    opts.origin?.trim() ? `Origin: ${opts.origin.trim()}` : null,
    opts.model ? `Model: ${opts.model}` : null,
    opts.description ? `Desc: ${opts.description}` : null,
    `OEM xref: ${partNumbers.join(", ")}`,
    opts.notesExtra ?? null,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers,
    name,
    description: [brand, ...detailBits].join(" · "),
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

/** Hydraulic misc stock — Stands as counted. */
export const hydraulicMiscParts: Part[] = [
  // --- Stand 37 ---
  hydraulicMisc({
    id: "hydraulic-misc-57276-s37",
    partNumber: "57276",
    partNumbers: ["57276", "HPV95", "HPV95 Series 7"],
    name: "CRADLE",
    description: "CRADLE",
    model: "HPV95 Series 7",
    quantity: 2,
    stand: 37,
    compatibility: ["HPV95", "HPV95 Series 7"],
  }),

  // --- Stand 7 (top row L→R) ---
  hydraulicMisc({
    id: "hydraulic-misc-59312-s7",
    partNumber: "59312",
    partNumbers: ["59312", "A8VO200"],
    name: "FRICTION PLATE",
    description: "FRICTION PLATE",
    model: "A8VO200",
    quantity: 10,
    stand: 7,
    compatibility: ["Rexroth A8VO200"],
  }),
  hydraulicMisc({
    id: "hydraulic-misc-05704-s7",
    partNumber: "05704",
    partNumbers: ["05704", "HPV116", "HPV116 (EX200-2/3)", "EX200-2", "EX200-3"],
    name: "FRICTION PLATE",
    description: "FRICTION PLATE",
    model: "HPV116 (EX200-2/3)",
    quantity: 10,
    stand: 7,
    compatibility: ["HPV116", "Hitachi EX200-2", "Hitachi EX200-3"],
  }),
  hydraulicMisc({
    id: "hydraulic-misc-67634-s7",
    partNumber: "67634",
    partNumbers: ["67634", "HMGC48", "HMGC48 (HMT135)", "HMT135"],
    name: "SEPARATION (MATING) PLATE",
    description: "SEPARATION (MATING) PLATE",
    model: "HMGC48 (HMT135)",
    quantity: 10,
    stand: 7,
    compatibility: ["HMGC48", "HMT135"],
  }),

  // --- Stand 8 (bottom row L→R) ---
  hydraulicMisc({
    id: "hydraulic-misc-57552-s8",
    partNumber: "57552",
    partNumbers: ["57552", "AP12", "AP12 (EX200-5)", "EX200-5"],
    name: "FRICTION PLATE",
    description: "FRICTION PLATE",
    model: "AP12 (EX200-5)",
    quantity: 10,
    stand: 8,
    compatibility: ["AP12", "Hitachi EX200-5"],
  }),
  hydraulicMisc({
    id: "hydraulic-misc-37213-s8",
    partNumber: "37213",
    partNumbers: ["37213", "HPV145"],
    name: "FEED BACK LEVER",
    description: "FEED BACK LEVER",
    model: "HPV145",
    quantity: 10,
    stand: 8,
    compatibility: ["HPV145"],
  }),
  hydraulicMisc({
    id: "hydraulic-misc-61601-s8",
    partNumber: "61601",
    partNumbers: ["61601", "SAS114", "KVC925", "SAS114/KVC925"],
    name: "SEPARATION (MATING) PLATE",
    description: "SEPARATION (MATING) PLATE",
    model: "SAS114/KVC925",
    quantity: 10,
    stand: 8,
    compatibility: ["SAS114", "KVC925"],
  }),
  hydraulicMisc({
    id: "hydraulic-misc-21887-s8",
    partNumber: "21887",
    partNumbers: ["21887", "K3V140", "K5V140", "K3V140/K5V140"],
    name: "FRICTION PLATE",
    description: "FRICTION PLATE",
    model: "K3V140/K5V140",
    quantity: 10,
    stand: 8,
    compatibility: ["Kawasaki K3V140", "Kawasaki K5V140"],
  }),

  // --- Stand 9 (far right bottom edge) ---
  hydraulicMisc({
    id: "hydraulic-misc-02353-s9",
    partNumber: "02353",
    partNumbers: ["02353", "A8VO200"],
    name: "SEPARATION (MATING) PLATE",
    description: "SEPARATION (MATING) PLATE",
    model: "A8VO200",
    quantity: 4,
    stand: 9,
    compatibility: ["Rexroth A8VO200"],
  }),
];
