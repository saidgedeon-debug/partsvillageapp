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
  /** Pump / unit this regulator fits, e.g. HPV145GW */
  model?: string;
  pumpModel?: string;
  /** e.g. 6=PORT & N=TYPE */
  config?: string;
  brand?: string;
  origin?: string;
  compatibility?: string[];
  notesExtra?: string;
}): Part {
  const pumpModel = (opts.model ?? opts.pumpModel)?.trim() || undefined;
  const partNumbers = opts.partNumbers?.length
    ? [...opts.partNumbers]
    : [opts.partNumber];
  if (pumpModel) {
    if (!partNumbers.some((p) => p.toLowerCase() === pumpModel.toLowerCase())) {
      partNumbers.push(pumpModel);
    }
  }
  const brand = opts.brand?.trim() || handok;
  const name =
    opts.name?.trim() ||
    opts.description?.trim() ||
    (pumpModel ? `Regulator ${pumpModel}` : `Regulator ${opts.partNumber}`);
  const detailBits = [
    pumpModel ? `Pump ${pumpModel}` : null,
    opts.description ?? null,
    opts.config?.trim() ? opts.config.trim() : null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    opts.stand != null ? `Stand ${opts.stand}` : null,
    `Manufacturer: ${brand}`,
    opts.origin?.trim() ? `Origin: ${opts.origin.trim()}` : null,
    pumpModel ? `Pump model: ${pumpModel}` : null,
    opts.description ? `Desc: ${opts.description}` : null,
    opts.config?.trim() ? `Config: ${opts.config.trim()}` : null,
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

/** Regulators stock — Stands as counted. */
export const regulatorParts: Part[] = [
  // --- Stand 33 ---
  regulator({
    id: "hydraulic-reg-47907-s33",
    partNumber: "47907",
    partNumbers: ["47907", "HPV145GW", "HPV145"],
    name: "REGULATOR ASS'Y(-)",
    description: "REGULATOR ASS'Y(-)",
    model: "HPV145GW",
    config: "6=PORT & N=TYPE",
    quantity: 1,
    stand: 33,
    compatibility: ["HPV145GW", "HPV145"],
  }),
  regulator({
    id: "hydraulic-reg-57309-s33",
    partNumber: "57309",
    partNumbers: ["57309", "HPV145GW", "HPV145"],
    name: "REGULATOR ASS'Y(+)",
    description: "REGULATOR ASS'Y(+)",
    model: "HPV145GW",
    config: "6=PORT & P=TYPE",
    quantity: 1,
    stand: 33,
    compatibility: ["HPV145GW", "HPV145"],
  }),
  regulator({
    id: "hydraulic-reg-60585-s33",
    partNumber: "60585",
    partNumbers: ["60585", "HPV116CW", "HPV116"],
    name: "REGULATOR ASS'Y(-)",
    description: "REGULATOR ASS'Y(-)",
    model: "HPV116CW",
    config: "6=PORT & N=TYPE",
    quantity: 2,
    stand: 33,
    compatibility: ["HPV116CW", "HPV116"],
  }),
];
