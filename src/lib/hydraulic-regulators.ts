/** regulators subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "regulators";

export function regulator(opts: {
  id: string;
  partNumber: string;
  partNumbers?: string[];
  name?: string;
  description?: string;
  quantity: number;
  stand?: number;
  /** Pump / unit this regulator fits, e.g. A8VO107 */
  pumpModel?: string;
  brand?: string;
  origin?: string;
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const partNumbers = opts.partNumbers?.length
    ? [...opts.partNumbers]
    : [opts.partNumber];
  if (opts.pumpModel?.trim()) {
    const m = opts.pumpModel.trim();
    if (!partNumbers.some((p) => p.toLowerCase() === m.toLowerCase())) {
      partNumbers.push(m);
    }
  }
  const brand = opts.brand?.trim() || handok;
  const name =
    opts.name?.trim() ||
    opts.description?.trim() ||
    (opts.pumpModel
      ? `Regulator ${opts.pumpModel}`
      : `Regulator ${opts.partNumber}`);
  const detailBits = [
    opts.pumpModel ? `Pump ${opts.pumpModel}` : null,
    opts.description ?? null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    `Manufacturer: ${brand}`,
    opts.origin?.trim() ? `Origin: ${opts.origin.trim()}` : null,
    opts.pumpModel ? `Pump model: ${opts.pumpModel}` : null,
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

/** Regulators stock — add rows here as inventory is counted. */
export const regulatorParts: Part[] = [];
