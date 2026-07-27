/** gear / pilot pump subcategory seed — Hydraulic Parts (Stands 38, 39, 41). */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "gear / pilot pump";

type Stand = 38 | 39 | 41;

function pump(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  stand: Stand;
  componentType?: string;
  compatibility: string[];
  shaftType?: string;
  rotation?: string;
  teethCount?: string;
  module?: string;
  mounting?: string;
  spline?: string;
  design?: string;
  bodyType?: string;
  displacement?: string;
  ageGroup?: string;
}): Part {
  const type = opts.componentType ?? "Gear Pump";
  const detailBits = [
    type,
    opts.displacement ?? null,
    opts.mounting ?? null,
    opts.spline ?? null,
    opts.teethCount ?? null,
    opts.module ?? null,
    opts.rotation ?? null,
    opts.shaftType ?? null,
    opts.bodyType ?? null,
    opts.design ?? null,
    opts.ageGroup ?? null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    `Stand ${opts.stand}`,
    `Manufacturer: ${handok}`,
    `Type: ${type}`,
    opts.displacement ? `Displacement: ${opts.displacement}` : null,
    opts.mounting ? `Mounting: ${opts.mounting}` : null,
    opts.spline ? `Spline: ${opts.spline}` : null,
    opts.teethCount ? `Teeth: ${opts.teethCount}` : null,
    opts.module ? `Module: ${opts.module}` : null,
    opts.rotation ? `Rotation: ${opts.rotation}` : null,
    opts.shaftType ? `Shaft: ${opts.shaftType}` : null,
    opts.bodyType ? `Body: ${opts.bodyType}` : null,
    opts.design ? `Design: ${opts.design}` : null,
    opts.ageGroup ? `Age: ${opts.ageGroup}` : null,
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

/** Stands 38, 39, 41 Handok gear / pilot pumps */
export const gearPilotPumpParts: Part[] = [
  // —— Stand 41 ——
  pump({
    id: "hydraulic-gp-34142",
    partNumber: "34142",
    partNumbers: ["34142", "HD-34142"],
    name: "Gear Pump Ass'y (HPV90 PC200-3)",
    quantity: 1,
    stand: 41,
    componentType: "Gear Pump Assembly",
    compatibility: ["Komatsu PC200-3", "HPV90"],
  }),
  pump({
    id: "hydraulic-gp-24808",
    partNumber: "24808",
    partNumbers: ["24808", "HD-24808"],
    name: "Gear Pump R-2B-KEY (HPV132 PC300-6)",
    quantity: 1,
    stand: 41,
    shaftType: "Keyed",
    rotation: "Right (R)",
    compatibility: ["Komatsu PC300-6", "HPV132"],
  }),
  pump({
    id: "hydraulic-gp-62261",
    partNumber: "62261",
    partNumbers: ["62261", "HD-62261"],
    name: "Gear Pump R-2B-12T-2.54M (H3V140DT Kayaba Type)",
    quantity: 1,
    stand: 41,
    teethCount: "12T",
    rotation: "Right (R)",
    module: "2.54M",
    compatibility: ["Hitachi H3V140DT", "Kayaba"],
  }),

  // —— Stand 39 ——
  pump({
    id: "hydraulic-gp-61878",
    partNumber: "61878",
    partNumbers: ["61878", "HD-61878"],
    name: "Gear Pump Ass'y 4-12T (K3V140/180DT In Drain)",
    quantity: 3,
    stand: 39,
    componentType: "Gear Pump Assembly",
    mounting: "4-Bolt",
    spline: "12T",
    design: "In Drain",
    compatibility: ["Kawasaki K3V140DT", "Kawasaki K3V180DT"],
  }),
  pump({
    id: "hydraulic-gp-yn10v00006f14-140",
    partNumber: "YN10V00006F14-140",
    partNumbers: ["YN10V00006F14-140", "YN10V00006F14140"],
    name: "Gear Pump Ass'y 4-Bolt (K3V180 12T=Kobelco)",
    quantity: 1,
    stand: 39,
    componentType: "Gear Pump Assembly",
    mounting: "4-Bolt",
    spline: "12T",
    compatibility: ["Kobelco", "Kawasaki K3V180"],
  }),
  pump({
    id: "hydraulic-gp-00214",
    partNumber: "00214",
    partNumbers: ["00214", "HD-00214"],
    name: "Gear Pump R-2B-13T-1.0M (H3V140DT Square Type)",
    quantity: 2,
    stand: 39,
    bodyType: "Square Type",
    teethCount: "13T",
    module: "1.0M",
    rotation: "Right (R)",
    compatibility: ["Hitachi H3V140DT"],
  }),

  // —— Stand 38 ——
  pump({
    id: "hydraulic-gp-4276918",
    partNumber: "4276918",
    partNumbers: ["4276918", "61882", "HD-4276918"],
    name: "Gear Pump Ass'y 16.8 CC/REV (HPV0102 L=10T / L=2B-10T-2.0M)",
    quantity: 2,
    stand: 38,
    componentType: "Gear Pump Assembly",
    displacement: "16.8 cc/rev",
    teethCount: "10T",
    rotation: "Left / CCW",
    compatibility: ["Komatsu HPV0102"],
  }),
  pump({
    id: "hydraulic-gp-61383",
    partNumber: "61383",
    partNumbers: ["61383", "HD-61383"],
    name: "Gear Pump R-2B-KEY (HPV75 PC60-6 Old)",
    quantity: 1,
    stand: 38,
    shaftType: "Keyed",
    rotation: "Right (R)",
    ageGroup: "OLD",
    compatibility: ["Komatsu PC60-6", "HPV75"],
  }),
];
