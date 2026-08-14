/** gears and shafts subcategory seed — Hydraulic Parts. */
import type { Part } from "@/lib/mock-data";

const handok = "Handok Hydraulic (South Korea)";
const sub = "gears and shafts";

function gear(opts: {
  id: string;
  partNumber: string;
  partNumbers: string[];
  name: string;
  quantity: number;
  stand: 101 | 42 | 43;
  manufacturer?: string;
  componentType: string;
  compatibility: string[];
  module?: string;
  teethCount?: string;
  lengthSpec?: string;
  notesExtra?: string;
}): Part {
  const mfr = opts.manufacturer ?? handok;
  const detailBits = [
    opts.componentType,
    opts.module ?? null,
    opts.teethCount ?? null,
    opts.lengthSpec ?? null,
  ].filter(Boolean);
  const noteBits = [
    `Subcategory: ${sub}`,
    `Stand ${opts.stand}`,
    `Manufacturer: ${mfr}`,
    `Type: ${opts.componentType}`,
    opts.module ? `Module: ${opts.module}` : null,
    opts.teethCount ? `Teeth: ${opts.teethCount}` : null,
    opts.lengthSpec ? `Length: ${opts.lengthSpec}` : null,
    `OEM xref: ${opts.partNumbers.join(", ")}`,
    opts.notesExtra ?? null,
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

const engrenages = "Engrenages Canada (Caterpillar Replacement)";

/** Gears and shafts — Stands as counted. */
export const gearsAndShaftsParts: Part[] = [
  // —— Stand 101 ——
  gear({
    id: "hydraulic-gs-01516-s12",
    partNumber: "01516",
    partNumbers: ["01516", "HD-01516", "HPV90", "HPV95"],
    name: "Drive Shaft Inner Components / Splined Gear Core — HPV90/95",
    quantity: 1,
    stand: 101,
    componentType: "Splined Gear Core / Drive Shaft Inner",
    compatibility: [
      "Komatsu HPV90",
      "Komatsu HPV95",
      "Komatsu PC200-3",
      "Komatsu PC200-5",
      "Komatsu PC200-6",
      "Komatsu PC200-7",
    ],
    notesExtra:
      "Interlocks within tandem pump center lines to distribute mechanical flywheel power",
  }),
  gear({
    id: "hydraulic-gs-706-76-41080-s12",
    partNumber: "706-76-41080",
    partNumbers: [
      "706-76-41080",
      "7067641080",
      "KMF40",
      "KMF41",
      "HD-706-76-41080",
    ],
    name: "Motor Center Shaft / Drive Connector Pinion — KMF40/41",
    quantity: 2,
    stand: 101,
    componentType: "Motor Center Shaft / Drive Connector Pinion",
    compatibility: [
      "Komatsu KMF40",
      "Komatsu KMF41",
      "Komatsu PC60-7",
      "Komatsu PC70-7",
      "Komatsu PC75UU",
    ],
    notesExtra:
      "Structural core for torque conversion inside midi slewing systems",
  }),
  gear({
    id: "hydraulic-gs-099-5818-s12",
    partNumber: "099-5818",
    partNumbers: ["099-5818", "0995818", "A8VO107"],
    name: "Main Piston Pump Center Shaft Pinion / Distribution Gear — A8VO107",
    quantity: 2,
    stand: 101,
    manufacturer: engrenages,
    componentType: "Center Shaft Pinion / Distribution Gear",
    compatibility: [
      "Rexroth A8VO107",
      "Uchida A8VO107",
      "Caterpillar 320B",
      "Caterpillar 320B L",
      "Caterpillar 320C",
      "Caterpillar 322B",
      "Caterpillar 325",
      "CAT 320B",
      "CAT 320C",
      "CAT 322B",
      "CAT 325",
    ],
    notesExtra:
      "Drives auxiliary or tandem inner gear meshes inside split block architecture",
  }),
  gear({
    id: "hydraulic-gs-177-2502-s12",
    partNumber: "177-2502",
    partNumbers: ["177-2502", "1772502", "A8VO200"],
    name: "Pump Center Shaft Pinion / Input Main Drive Gear — A8VO200",
    quantity: 1,
    stand: 101,
    manufacturer: engrenages,
    componentType: "Center Shaft Pinion / Input Main Drive Gear",
    compatibility: [
      "Rexroth A8VO200",
      "Uchida A8VO200",
      "Caterpillar 345B",
      "Caterpillar 345B L",
      "Caterpillar 345C",
      "Caterpillar 345D",
      "Caterpillar 350",
      "CAT 345B",
      "CAT 345C",
      "CAT 345D",
      "CAT 350",
    ],
    notesExtra:
      "Handles high-torque energy distribution across large tandem pump structures",
  }),

  // —— Stand 43 ——
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
