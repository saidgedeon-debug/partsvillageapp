/** drive shafts subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "drive shafts";

export function driveShaft(opts: {
  id: string;
  partNumber: string;
  partNumbers?: string[];
  name?: string;
  description?: string;
  quantity: number;
  stand?: number;
  /** e.g. 24 or "24T" */
  splines?: number | string;
  lengthMm?: number;
  diameterMm?: number;
  model?: string;
  brand?: string;
  origin?: string;
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const partNumbers = opts.partNumbers?.length
    ? opts.partNumbers
    : [opts.partNumber];
  if (opts.model?.trim()) {
    const m = opts.model.trim();
    if (!partNumbers.some((p) => p.toLowerCase() === m.toLowerCase())) {
      partNumbers.push(m);
    }
  }
  const name = opts.name?.trim() || opts.description?.trim() || `Drive Shaft ${opts.partNumber}`;
  const brand = opts.brand?.trim() || handok;
  const splinesLabel =
    opts.splines == null
      ? null
      : typeof opts.splines === "number"
        ? `${opts.splines}T`
        : String(opts.splines).trim();
  const detailBits = [
    opts.model ?? null,
    opts.description ?? null,
    splinesLabel ? `Splines ${splinesLabel}` : null,
    opts.lengthMm != null ? `L ${opts.lengthMm} mm` : null,
    opts.diameterMm != null ? `Ø ${opts.diameterMm} mm` : null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    `Manufacturer: ${brand}`,
    opts.origin?.trim() ? `Origin: ${opts.origin.trim()}` : null,
    opts.model ? `Model: ${opts.model}` : null,
    opts.description ? `Desc: ${opts.description}` : null,
    splinesLabel ? `Splines: ${splinesLabel}` : null,
    opts.lengthMm != null ? `Length: ${opts.lengthMm} mm` : null,
    opts.diameterMm != null ? `Diameter: ${opts.diameterMm} mm` : null,
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

/** Drive shafts stock — Stands as counted. */
export const driveShaftParts: Part[] = [
  driveShaft({
    id: "hydraulic-ds-05746",
    partNumber: "05746",
    partNumbers: ["05746", "A8VO107", "A8VO107(CAT225)"],
    name: "DRIVE SHAFT(R)(LONG)",
    description: "DRIVE SHAFT(R)(LONG)",
    model: "A8VO107(CAT225)",
    splines: "24T",
    quantity: 4,
    stand: 40,
    brand: "HAN DOK HYDRAULIC CO.",
    origin: "MADE IN KOREA",
    compatibility: ["Rexroth A8VO107", "Caterpillar 225", "CAT 225"],
  }),

  // --- Stand 32 ---
  driveShaft({
    id: "hydraulic-ds-099-5864-s32",
    partNumber: "099-5864",
    partNumbers: ["099-5864", "0995864", "A8VO107"],
    name: "DRIVE SHAFT",
    description: "DRIVE SHAFT",
    model: "A8VO107",
    quantity: 1,
    stand: 32,
    compatibility: ["Rexroth A8VO107"],
  }),

  // --- Stand 36 ---
  driveShaft({
    id: "hydraulic-ds-59380-s36",
    partNumber: "59380",
    partNumbers: ["59380", "A8VO200"],
    name: "DRIVE SHAFT",
    description: "DRIVE SHAFT",
    model: "A8VO200",
    quantity: 1,
    stand: 36,
    compatibility: ["Rexroth A8VO200"],
  }),

  // --- Stand 47 ---
  driveShaft({
    id: "hydraulic-ds-59379-s47",
    partNumber: "59379",
    partNumbers: ["59379", "A8VO200"],
    name: "DRIVE SHAFT(R)(LONG)",
    description: "DRIVE SHAFT(R)(LONG)",
    model: "A8VO200",
    splines: "55T",
    quantity: 1,
    stand: 47,
    compatibility: ["Rexroth A8VO200"],
  }),
  driveShaft({
    id: "hydraulic-ds-32070-s47",
    partNumber: "32070",
    partNumbers: ["32070", "A7VO250L/EL", "A7VO250"],
    name: "DRIVE SHAFT(SPLINE TYPE)",
    description: "DRIVE SHAFT(SPLINE TYPE)",
    model: "A7VO250L/EL",
    quantity: 1,
    stand: 47,
    compatibility: ["Rexroth A7VO250"],
  }),
  driveShaft({
    id: "hydraulic-ds-42369-s47",
    partNumber: "42369",
    partNumbers: ["42369", "A8VO107", "A8VO107 (CAT320)", "A8VO107(CAT320)"],
    name: "DRIVE SHAFT(R)(LONG)",
    description: "DRIVE SHAFT(R)(LONG)",
    model: "A8VO107 (CAT320)",
    splines: "20T",
    quantity: 1,
    stand: 47,
    compatibility: ["Rexroth A8VO107", "Caterpillar 320", "CAT 320"],
  }),
  driveShaft({
    id: "hydraulic-ds-05715-s47",
    partNumber: "05715",
    partNumbers: ["05715", "HPV116CW", "HPV116"],
    name: "DRIVE SHAFT",
    description: "DRIVE SHAFT",
    model: "HPV116CW",
    quantity: 3,
    stand: 47,
    compatibility: ["HPV116"],
  }),
  // Duplicate 02344 entries on Stand 47 merged → qty 2
  driveShaft({
    id: "hydraulic-ds-02344-s47",
    partNumber: "02344",
    partNumbers: ["02344", "A8VO200"],
    name: "DRIVE SHAFT(R)(LONG)",
    description: "DRIVE SHAFT(R)(LONG)",
    model: "A8VO200",
    splines: "46T",
    quantity: 2,
    stand: 47,
    compatibility: ["Rexroth A8VO200"],
  }),

  // --- Stand 53 ---
  driveShaft({
    id: "hydraulic-ds-02345-s53",
    partNumber: "02345",
    partNumbers: ["02345", "A8VO200"],
    name: "DRIVE SHAFT(L)(SHORT)",
    description: "DRIVE SHAFT(L)(SHORT)",
    model: "A8VO200",
    splines: "46T",
    quantity: 1,
    stand: 53,
    compatibility: ["Rexroth A8VO200"],
  }),
  driveShaft({
    id: "hydraulic-ds-2023203-s53",
    partNumber: "2023203",
    partNumbers: ["2023203", "HMGC48", "HMGC48(HMT135)", "HMT135"],
    name: "DRIVE SHAFT",
    description: "DRIVE SHAFT",
    model: "HMGC48(HMT135)",
    quantity: 1,
    stand: 53,
    compatibility: ["HMGC48", "HMT135"],
  }),
  driveShaft({
    id: "hydraulic-ds-61492-s53",
    partNumber: "61492",
    partNumbers: ["61492", "HMGF35/36", "HMGF35/36(HMV116)", "HMV116"],
    name: "DRIVE SHAFT",
    description: "DRIVE SHAFT",
    model: "HMGF35/36(HMV116)",
    quantity: 1,
    stand: 53,
    compatibility: ["HMGF35", "HMGF36", "HMV116"],
  }),

  // --- Stand 55 ---
  driveShaft({
    id: "hydraulic-ds-38232-s55",
    partNumber: "38232",
    partNumbers: ["38232", "A8VO107"],
    name: "DRIVE SHAFT(L)(SHORT)",
    description: "DRIVE SHAFT(L)(SHORT)",
    model: "A8VO107",
    quantity: 3,
    stand: 55,
    compatibility: ["Rexroth A8VO107"],
  }),
  driveShaft({
    id: "hydraulic-ds-63857-s55",
    partNumber: "63857",
    partNumbers: ["63857", "KMF125"],
    name: "DRIVE SHAFT",
    description: "DRIVE SHAFT",
    model: "KMF125",
    quantity: 2,
    stand: 55,
    compatibility: ["KMF125"],
  }),

  // --- Stand 63 ---
  driveShaft({
    id: "hydraulic-ds-46183-s63",
    partNumber: "46183",
    partNumbers: ["46183", "A8VO160"],
    name: "DRIVE SHAFT(R)(LONG)",
    description: "DRIVE SHAFT(R)(LONG)",
    model: "A8VO160",
    quantity: 1,
    stand: 63,
    compatibility: ["Rexroth A8VO160"],
  }),
  driveShaft({
    id: "hydraulic-ds-49535-s63",
    partNumber: "49535",
    partNumbers: ["49535", "HPV0102", "HPV0102(ϕ 65)", "HPV0102(φ 65)"],
    name: "DRIVE SHAFT(R)(LONG)",
    description: "DRIVE SHAFT(R)(LONG)",
    model: "HPV0102(ϕ 65)",
    quantity: 1,
    stand: 63,
    compatibility: ["HPV0102"],
    notesExtra: "Ø 65",
  }),
];
