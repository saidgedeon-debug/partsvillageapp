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
];
