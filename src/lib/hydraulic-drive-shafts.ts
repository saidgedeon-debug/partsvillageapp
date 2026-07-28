/** drive shafts subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const sub = "drive shafts";

export function driveShaft(opts: {
  id: string;
  partNumber: string;
  partNumbers?: string[];
  name?: string;
  quantity: number;
  stand?: number;
  splines?: number;
  lengthMm?: number;
  diameterMm?: number;
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const partNumbers = opts.partNumbers?.length
    ? opts.partNumbers
    : [opts.partNumber];
  const name = opts.name?.trim() || `Drive Shaft ${opts.partNumber}`;
  const detailBits = [
    opts.splines != null ? `${opts.splines} splines` : null,
    opts.lengthMm != null ? `L ${opts.lengthMm} mm` : null,
    opts.diameterMm != null ? `Ø ${opts.diameterMm} mm` : null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    opts.splines != null ? `Splines: ${opts.splines}` : null,
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
    description: ["Drive Shaft", ...detailBits].join(" · "),
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

/** Drive shafts stock — add rows here as inventory is counted. */
export const driveShaftParts: Part[] = [];
