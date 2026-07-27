/** gears and shafts subcategory seed — Hydraulic Parts (Stands 42–43). */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "gears and shafts";

function gear(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  stand: 42 | 43;
  componentType: string;
  compatibility: string[];
  module?: string;
  teethCount?: string;
  lengthSpec?: string;
}): Part {
  const detailBits = [
    opts.componentType,
    opts.module ?? null,
    opts.teethCount ?? null,
    opts.lengthSpec ?? null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    `Stand ${opts.stand}`,
    `Manufacturer: ${handok}`,
    `Type: ${opts.componentType}`,
    opts.module ? `Module: ${opts.module}` : null,
    opts.teethCount ? `Teeth: ${opts.teethCount}` : null,
    opts.lengthSpec ? `Length: ${opts.lengthSpec}` : null,
    `OEM xref: ${opts.partNumbers.join(", ")}`,
  ].filter(Boolean);

  return {
    id: opts.id,
    partNumber: opts.partNumber,
    partNumbers: opts.partNumbers,
    name: opts.name,
    description: [handok, opts.name, ...detailBits].join(" · "),
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

/** Stands 42–43 Handok gears and shafts */
export const gearsAndShaftsParts: Part[] = [
  gear({
    id: "hydraulic-gs-59397",
    partNumber: "59397",
    partNumbers: ["59397", "HD-59397"],
    name: "Idler (Helical) Gear (A8VO160 M2.5X49T)",
    quantity: 19,
    stand: 43,
    componentType: "Helical Idler Gear",
    module: "M2.5",
    teethCount: "49T",
    compatibility: ["Rexroth A8VO160"],
  }),
  gear({
    id: "hydraulic-gs-58821",
    partNumber: "58821",
    partNumbers: ["58821", "HD-58821"],
    name: "Idler Gear with Shaft (A8VO107 M2.5X43T=22L)",
    quantity: 13,
    stand: 42,
    componentType: "Idler Gear Assembly",
    module: "M2.5",
    teethCount: "43T",
    lengthSpec: "22L",
    compatibility: ["Rexroth A8VO107"],
  }),
];
