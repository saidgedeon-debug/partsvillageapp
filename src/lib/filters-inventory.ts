/** Filters catalog seed — Parts Village (Sakura / Donaldson + depot stand sheets). */
import type { Part } from "@/lib/mock-data";
import { FILTER_STAND_LISTINGS } from "@/lib/filters-stand-sheet";

export const FILTER_SUBCATEGORIES = [
  "Engine Lube",
  "Fuel System",
  "Hydraulics",
  "Air Intake",
  "Cooling System",
  "Other",
] as const;

export type FilterSubcategory = (typeof FILTER_SUBCATEGORIES)[number];

type CrossRefs = Record<string, string>;

function slugId(partNumber: string) {
  return `filter-${partNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizePn(s: string) {
  return s.toUpperCase().replace(/\s+/g, "").replace(/–|—/g, "-");
}

function inferBrand(partNumber: string): string {
  const p = normalizePn(partNumber);
  if (/^P\d/.test(p) || p.startsWith("P55") || p.startsWith("P17") || p.startsWith("P77") || p.startsWith("P53") || p.startsWith("P16") || p.startsWith("P12") || p.startsWith("P18") || p.startsWith("P90")) {
    return "Donaldson";
  }
  if (/^(LF|FF|FS|WF)/.test(p)) return "Fleetguard";
  if (/^\d{5,}$/.test(p) || p.startsWith("265") || p.startsWith("117")) return "OEM";
  return "Sakura";
}

function inferSubcategory(partNumber: string): FilterSubcategory {
  const p = normalizePn(partNumber);
  if (
    p.startsWith("FC") ||
    p.startsWith("SFC") ||
    p.startsWith("FS") ||
    p.startsWith("FF") ||
    p.startsWith("TC") ||
    p.startsWith("SF") ||
    p.startsWith("PO") ||
    p.startsWith("WL")
  ) {
    return "Fuel System";
  }
  if (p.startsWith("WC")) return "Cooling System";
  if (
    p.startsWith("HC") ||
    p.startsWith("H-") ||
    p.startsWith("EH") ||
    p.startsWith("AH") ||
    p.startsWith("CH") ||
    /^H\d/.test(p)
  ) {
    return "Hydraulics";
  }
  if (p.startsWith("A-") || p.startsWith("CA") || p.startsWith("AM") || /^A\d/.test(p)) {
    return "Air Intake";
  }
  if (
    p.startsWith("LF") ||
    p.startsWith("C-") ||
    /^C\d/.test(p) ||
    p.startsWith("EO") ||
    p.startsWith("EF") ||
    p.startsWith("FB") ||
    p.startsWith("O-") ||
    /^O\d/.test(p)
  ) {
    return "Engine Lube";
  }
  if (p.startsWith("P")) {
    // Donaldson P-series: default lube unless fuel/air patterns known
    if (/^P55(0|1|4|5)/.test(p) || p.includes("FUEL")) return "Fuel System";
    if (/^P(17|18|53|77)/.test(p)) return "Air Intake";
    return "Engine Lube";
  }
  return "Other";
}

function filterPart(opts: {
  partNumber: string;
  brand: string;
  subCategory: FilterSubcategory;
  heightMm?: number;
  outerDiameterMm?: number;
  threadSize?: string;
  micronRating?: string;
  crossReferences?: CrossRefs;
  /** Handwritten sheet row (number or label like 14H). */
  sheetRow?: number | string;
  /** Extra stands where this PN appears. */
  stands?: number[];
  quantity?: number;
}): Part {
  const xrefEntries = Object.entries(opts.crossReferences ?? {});
  const xrefNums = xrefEntries.map(([, v]) => v.trim()).filter(Boolean);
  const partNumbers = [opts.partNumber, ...xrefNums].filter(
    (n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i,
  );

  const stands = [...new Set(opts.stands ?? [])].sort((a, b) => a - b);
  const primaryStand =
    typeof opts.sheetRow === "number" && Number.isFinite(opts.sheetRow)
      ? opts.sheetRow
      : stands[0];
  const sheet =
    stands.length > 0
      ? `Stand${stands.length > 1 ? "s" : ""} ${stands.join(", ")}`
      : opts.sheetRow == null
        ? null
        : typeof opts.sheetRow === "number"
          ? `Sheet row ${opts.sheetRow}`
          : `Sheet row ${opts.sheetRow}`;

  const sizeBits = [
    opts.heightMm != null ? `H ${opts.heightMm} mm` : null,
    opts.outerDiameterMm != null ? `OD ${opts.outerDiameterMm} mm` : null,
    opts.threadSize?.trim() || null,
    opts.micronRating?.trim() || null,
  ].filter(Boolean);

  const noteBits = [
    `Subcategory: ${opts.subCategory}`,
    `Brand: ${opts.brand}`,
    opts.heightMm != null ? `Height: ${opts.heightMm} mm` : null,
    opts.outerDiameterMm != null ? `Outer Ø: ${opts.outerDiameterMm} mm` : null,
    opts.threadSize ? `Thread: ${opts.threadSize}` : null,
    opts.micronRating ? `Rating: ${opts.micronRating}` : null,
    xrefEntries.length
      ? `Xref: ${xrefEntries.map(([k, v]) => `${k} ${v}`).join(", ")}`
      : null,
    sheet,
  ].filter(Boolean);

  const qty = opts.quantity ?? 0;

  return {
    id: slugId(opts.partNumber),
    partNumber: opts.partNumber,
    partNumbers,
    name: `${opts.brand} ${opts.subCategory} Filter ${opts.partNumber}`,
    description: [opts.brand, opts.subCategory, ...sizeBits].join(" · "),
    category: "Filters",
    subcategory: opts.subCategory,
    boxNumber: primaryStand,
    insideDiameterMm:
      opts.outerDiameterMm != null ? String(opts.outerDiameterMm) : undefined,
    quantity: qty,
    reorderAt: qty > 0 ? Math.max(1, Math.min(2, Math.floor(qty / 2) || 1)) : 0,
    cost: 0,
    price: 0,
    compatibility: [opts.brand, "Filters", opts.subCategory],
    notes: noteBits.join(" · "),
  };
}

/** Spec-rich seed from the first Sakura/Donaldson import. */
const detailedFilterParts: Part[] = [
  // --- Engine Lube ---
  filterPart({
    partNumber: "C-5501",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 262,
    outerDiameterMm: 108,
    threadSize: "1 1/8-16 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "1R-0739",
      Donaldson: "P550388",
      Fleetguard: "LF3328",
      Baldwin: "B7299",
      Wix: "51792",
    },
    sheetRow: 1,
  }),
  filterPart({
    partNumber: "C-2508",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 206,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "15 Micron",
    crossReferences: {
      CAT: "1R-0734",
      Donaldson: "P550132",
      Fleetguard: "LF667",
      Baldwin: "B75",
      Wix: "51251",
    },
    sheetRow: 1,
  }),
  filterPart({
    partNumber: "C-6204",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 140,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "25 Micron",
    crossReferences: {
      CAT: "1W-4136",
      Donaldson: "P554136",
      Fleetguard: "LF3343",
      Baldwin: "B93",
      Wix: "51261",
    },
    sheetRow: 3,
  }),
  filterPart({
    partNumber: "C-6202",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 137,
    outerDiameterMm: 76,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "5S-4841",
      Donaldson: "P554841",
      Fleetguard: "LF3481",
      Baldwin: "B43-S",
      Wix: "51451",
    },
    sheetRow: 4,
  }),
  filterPart({
    partNumber: "C-55221",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 265,
    outerDiameterMm: 108,
    threadSize: "1 1/8-16 UNF-2B",
    micronRating: "15 Micron",
    crossReferences: {
      CAT: "1R-1807",
      Donaldson: "P551807",
      Fleetguard: "LF9009",
      Baldwin: "BD103",
      Wix: "51791",
    },
    sheetRow: 1,
  }),
  filterPart({
    partNumber: "C-5726",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 230,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "1R-0716",
      Donaldson: "P550367",
      Fleetguard: "LF3345",
      Baldwin: "B76",
      Wix: "51252",
    },
    sheetRow: 1,
  }),
  filterPart({
    partNumber: "C-1823",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 175,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "7W-5495",
      Donaldson: "P555495",
      Fleetguard: "LF3549",
      Baldwin: "B236",
      Wix: "51515",
    },
    sheetRow: 5,
  }),
  filterPart({
    partNumber: "C-1855",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 140,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "25 Micron",
    crossReferences: {
      CAT: "2P-4005",
      Donaldson: "P554005",
      Fleetguard: "LF3349",
      Baldwin: "B96",
      Wix: "51258",
    },
    sheetRow: 5,
  }),
  filterPart({
    partNumber: "C-5504",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 168,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "1R-0734",
      Donaldson: "P550387",
      Fleetguard: "LF3474",
      Baldwin: "B7222",
      Wix: "51268",
    },
    sheetRow: 3,
  }),
  filterPart({
    partNumber: "C-5519",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 262,
    outerDiameterMm: 108,
    threadSize: "1 1/8-16 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "1R-1808",
      Donaldson: "P551808",
      Fleetguard: "LF9010",
      Baldwin: "BD353",
      Wix: "51797",
    },
    sheetRow: 130,
  }),
  filterPart({
    partNumber: "C-1303",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 142,
    outerDiameterMm: 93,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "15 Micron",
    crossReferences: {
      CAT: "122-7353",
      Donaldson: "P551353",
      Fleetguard: "LF3753",
      Baldwin: "B1434",
      Wix: "51315",
    },
    sheetRow: 2,
  }),
  filterPart({
    partNumber: "C-1305",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 210,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "324-2598",
      Donaldson: "P552598",
      Fleetguard: "LF16166",
      Baldwin: "B7378",
      Wix: "51324",
    },
    sheetRow: 2,
  }),
  filterPart({
    partNumber: "C-6102",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 100,
    outerDiameterMm: 76,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "1R-1808",
      Donaldson: "P551808",
      Fleetguard: "LF3654",
      Baldwin: "B227",
      Wix: "51348",
    },
    sheetRow: 2,
  }),
  filterPart({
    partNumber: "C-6213",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 262,
    outerDiameterMm: 108,
    threadSize: "1 1/8-16 UNF-2B",
    micronRating: "15 Micron",
    crossReferences: {
      CAT: "1R-1808",
      Donaldson: "P551808",
      Fleetguard: "LF9010",
      Baldwin: "BD353",
      Wix: "51797",
    },
    sheetRow: 79,
  }),
  filterPart({
    partNumber: "C-5105",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 168,
    outerDiameterMm: 93,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "7W-5495",
      Donaldson: "P555495",
      Fleetguard: "LF3495",
      Baldwin: "B236",
      Wix: "51515",
    },
    sheetRow: 79,
  }),
  filterPart({
    partNumber: "C-5705",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 210,
    outerDiameterMm: 108,
    threadSize: "1 1/8-16 UNF-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "1R-1807",
      Donaldson: "P550425",
      Fleetguard: "LF17502",
      Baldwin: "B7409",
      Wix: "51660",
    },
    sheetRow: 79,
  }),
  filterPart({
    partNumber: "C-5730",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 170,
    outerDiameterMm: 108,
    threadSize: "1 1/8-16 UNF-2B",
    micronRating: "12 Micron",
    crossReferences: {
      CAT: "21707132",
      Donaldson: "P550425",
      Fleetguard: "LF17502",
      Baldwin: "B7685",
      Wix: "51660",
    },
    sheetRow: 121,
  }),
  filterPart({
    partNumber: "C-7005",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 135,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "1R-0734",
      Donaldson: "P550387",
      Fleetguard: "LF3658",
      Baldwin: "B7222",
      Wix: "51268",
    },
    sheetRow: 141,
  }),
  filterPart({
    partNumber: "C-5715",
    brand: "Sakura",
    subCategory: "Engine Lube",
    heightMm: 140,
    outerDiameterMm: 108,
    threadSize: "1 1/8-16 UNF-2B",
    micronRating: "20 Micron",
    crossReferences: {
      CAT: "21707133",
      Donaldson: "P550425",
      Fleetguard: "LF17502",
      Baldwin: "B7409",
      Wix: "51660",
    },
    sheetRow: 133,
  }),
  filterPart({
    partNumber: "P551670",
    brand: "Donaldson",
    subCategory: "Engine Lube",
    heightMm: 250,
    outerDiameterMm: 116,
    threadSize: "1 1/2-12 UNF-2B",
    micronRating: "30 Micron",
    crossReferences: {
      Wix: "51671",
      Fleetguard: "LF670",
      Baldwin: "B7577",
      CAT: "1P-2299",
    },
    sheetRow: 123,
  }),

  // --- Fuel System ---
  filterPart({
    partNumber: "C-5102",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 168,
    outerDiameterMm: 93,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "7W-2326",
      Perkins: "26540347",
      Donaldson: "P550388",
      Fleetguard: "FF5018",
      Baldwin: "BF912",
      Wix: "33358",
    },
    sheetRow: 1,
  }),
  filterPart({
    partNumber: "C-5101",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 140,
    outerDiameterMm: 93,
    threadSize: "1-14 UNS-2B",
    micronRating: "5 Micron",
    crossReferences: {
      CAT: "1R-0750",
      Donaldson: "P551313",
      Fleetguard: "FF5320",
      Baldwin: "BF7633",
      Wix: "33528",
    },
    sheetRow: 3,
  }),
  filterPart({
    partNumber: "C-1118",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 120,
    outerDiameterMm: 76,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "12 Micron",
    crossReferences: {
      CAT: "4N-5823",
      Donaldson: "P555823",
      Fleetguard: "FF105",
      Baldwin: "BF957",
      Wix: "33374",
    },
    sheetRow: 4,
  }),
  filterPart({
    partNumber: "FC-1104",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 174,
    outerDiameterMm: 93,
    threadSize: "1-14 UNS-2B",
    micronRating: "2 Micron",
    crossReferences: {
      CAT: "1R-0749",
      Donaldson: "P551311",
      Fleetguard: "FF5319",
      Baldwin: "BF7587",
      Wix: "33674",
    },
    sheetRow: 1,
  }),
  filterPart({
    partNumber: "C-5703",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 150,
    outerDiameterMm: 93,
    threadSize: "1-14 UNS-2B",
    micronRating: "2 Micron",
    crossReferences: {
      CAT: "1R-0751",
      Donaldson: "P551315",
      Fleetguard: "FF5324",
      Baldwin: "BF7632",
      Wix: "33524",
    },
    sheetRow: 5,
  }),
  filterPart({
    partNumber: "FC-5505",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 150,
    outerDiameterMm: 93,
    threadSize: "1-14 UNS-2B",
    micronRating: "5 Micron",
    crossReferences: {
      CAT: "1R-0751",
      Donaldson: "P551315",
      Fleetguard: "FF5324",
      Baldwin: "BF7632",
      Wix: "33524",
    },
    sheetRow: 26,
  }),
  filterPart({
    partNumber: "FC-1702",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 174,
    outerDiameterMm: 93,
    threadSize: "1-14 UNS-2B",
    micronRating: "2 Micron",
    crossReferences: {
      CAT: "1R-0751",
      Donaldson: "P551315",
      Fleetguard: "FF5324",
      Baldwin: "BF7632",
      Wix: "33524",
    },
    sheetRow: 2,
  }),
  filterPart({
    partNumber: "FC-1824",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 174,
    outerDiameterMm: 93,
    threadSize: "1-14 UNS-2B",
    micronRating: "5 Micron",
    crossReferences: {
      CAT: "1R-0751",
      Donaldson: "P551315",
      Fleetguard: "FF5324",
      Baldwin: "BF7632",
      Wix: "33524",
    },
    sheetRow: "14H",
  }),
  filterPart({
    partNumber: "SFC-55170",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 195,
    outerDiameterMm: 108,
    threadSize: "1-14 UNS-2B",
    micronRating: "12 Micron",
    crossReferences: {
      CAT: "1R-0770",
      Donaldson: "P550625",
      Fleetguard: "FS19641",
      Baldwin: "BF1399-SP",
      Wix: "33770",
    },
    sheetRow: 74,
  }),
  filterPart({
    partNumber: "SFC-5504-02",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 170,
    outerDiameterMm: 93,
    threadSize: "1-14 UNS-2B",
    micronRating: "2 Micron",
    crossReferences: {
      CAT: "1R-0770",
      Donaldson: "P551740",
      Fleetguard: "FS19769",
      Baldwin: "BF1397-SP",
      Wix: "33674",
    },
    sheetRow: 29,
  }),
  filterPart({
    partNumber: "SFC-51170",
    brand: "Sakura",
    subCategory: "Fuel System",
    heightMm: 195,
    outerDiameterMm: 108,
    threadSize: "1-14 UNS-2B",
    micronRating: "4 Micron",
    crossReferences: {
      CAT: "326-1644",
      Donaldson: "P551001",
      Fleetguard: "FS20007",
      Baldwin: "BF1393-SP",
      Wix: "33654",
    },
    sheetRow: 120,
  }),

  // --- Hydraulic Filters ---
  filterPart({
    partNumber: "H-5504",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 230,
    outerDiameterMm: 130,
    threadSize: "Cartridge",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "1G-8878",
      Donaldson: "P554470",
      Fleetguard: "HF6162",
      Baldwin: "PT83",
      Wix: "51162",
    },
    sheetRow: 1,
  }),
  filterPart({
    partNumber: "HC-6501",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 202,
    outerDiameterMm: 130,
    threadSize: "1 1/2-12 UNF-2B",
    micronRating: "12 Micron",
    crossReferences: {
      CAT: "3I-1438",
      Donaldson: "P550388",
      Fleetguard: "HF6510",
      Baldwin: "BT365-10",
      Wix: "51731",
    },
    sheetRow: 122,
  }),
  filterPart({
    partNumber: "C-5505",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 140,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "15 Micron",
    crossReferences: {
      CAT: "3I-0601",
      Donaldson: "P550601",
      Fleetguard: "LF667",
      Baldwin: "BT216",
      Wix: "51251",
    },
    sheetRow: 3,
  }),
  filterPart({
    partNumber: "C-6210",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 115,
    outerDiameterMm: 76,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "4J-6064",
      Donaldson: "P556064",
      Fleetguard: "HF6064",
      Baldwin: "BT287-10",
      Wix: "51453",
    },
    sheetRow: 4,
  }),
  filterPart({
    partNumber: "HC-5511",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 242,
    outerDiameterMm: 128,
    threadSize: "1 3/4-12 UN-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "3I-1472",
      Donaldson: "P551472",
      Fleetguard: "HF6520",
      Baldwin: "BT387-10",
      Wix: "51472",
    },
    sheetRow: 215,
  }),
  filterPart({
    partNumber: "HC-6502",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 178,
    outerDiameterMm: 97,
    threadSize: "1 3/8-12 UNF-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "9J-0740",
      Donaldson: "P550740",
      Fleetguard: "HF6553",
      Baldwin: "BT366-10",
      Wix: "51721",
    },
    sheetRow: 215,
  }),
  filterPart({
    partNumber: "H-2801",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 280,
    outerDiameterMm: 130,
    threadSize: "Cartridge",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "4I-3948",
      Donaldson: "P553948",
      Fleetguard: "HF28948",
      Baldwin: "PT9348",
      Wix: "57248",
    },
    sheetRow: 215,
  }),
  filterPart({
    partNumber: "C-1821",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 140,
    outerDiameterMm: 93,
    threadSize: "1-12 UNF-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "3I-1435",
      Donaldson: "P551435",
      Fleetguard: "HF6510",
      Baldwin: "BT216",
      Wix: "51251",
    },
    sheetRow: 219,
  }),
  filterPart({
    partNumber: "C-7912",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 96,
    outerDiameterMm: 76,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "9J-5461",
      Donaldson: "P555461",
      Fleetguard: "HF6056",
      Baldwin: "BT287",
      Wix: "51453",
    },
    sheetRow: 219,
  }),
  filterPart({
    partNumber: "HC-5507",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 202,
    outerDiameterMm: 97,
    threadSize: "1 3/8-12 UNF-2B",
    micronRating: "12 Micron",
    crossReferences: {
      CAT: "1R-0719",
      Donaldson: "P550719",
      Fleetguard: "HF6513",
      Baldwin: "BT366",
      Wix: "51721",
    },
    sheetRow: 315,
  }),
  filterPart({
    partNumber: "HC-5512",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 115,
    outerDiameterMm: 76,
    threadSize: "3/4-16 UNF-2B",
    micronRating: "5 Micron",
    crossReferences: {
      CAT: "093-7521",
      Donaldson: "P551348",
      Fleetguard: "HF35018",
      Baldwin: "BT305",
      Wix: "51621",
    },
    sheetRow: 315,
  }),
  filterPart({
    partNumber: "HC-5505",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 242,
    outerDiameterMm: 128,
    threadSize: "1 3/4-12 UN-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "1R-0722",
      Donaldson: "P550722",
      Fleetguard: "HF6510",
      Baldwin: "BT387",
      Wix: "51472",
    },
    sheetRow: 320,
  }),
  filterPart({
    partNumber: "H-4904",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 450,
    outerDiameterMm: 150,
    threadSize: "Cartridge",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "1R-0735",
      Donaldson: "P550735",
      Fleetguard: "HF4904",
      Baldwin: "PT9404",
      Wix: "51494",
    },
    sheetRow: 320,
  }),
  filterPart({
    partNumber: "HC-7932",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 210,
    outerDiameterMm: 128,
    threadSize: "1 3/4-12 UN-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "179-9806",
      Donaldson: "P559806",
      Fleetguard: "HF28932",
      Baldwin: "BT9332",
      Wix: "57932",
    },
    sheetRow: 320,
  }),
  filterPart({
    partNumber: "HC-5506",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 290,
    outerDiameterMm: 128,
    threadSize: "1 3/4-12 UN-2B",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "1R-0722",
      Donaldson: "P550722",
      Fleetguard: "HF6520",
      Baldwin: "BT388",
      Wix: "51472",
    },
    sheetRow: "14H",
  }),
  filterPart({
    partNumber: "H-7942",
    brand: "Sakura",
    subCategory: "Hydraulics",
    heightMm: 310,
    outerDiameterMm: 85,
    threadSize: "Cartridge",
    micronRating: "10 Micron",
    crossReferences: {
      CAT: "1R-0728",
      Donaldson: "P550728",
      Fleetguard: "HF7942",
      Baldwin: "PT8442",
      Wix: "51728",
    },
    sheetRow: 122,
  }),

  // --- Air Intake ---
  filterPart({
    partNumber: "A-5550",
    brand: "Sakura",
    subCategory: "Air Intake",
    heightMm: 345,
    outerDiameterMm: 165,
    threadSize: "Radial Seal Inner/Outer",
    micronRating: "3 Micron",
    crossReferences: {
      CAT: "142-1340",
      Donaldson: "P532501",
      Fleetguard: "AF25557",
      Baldwin: "RS3544",
      Wix: "46562",
    },
    sheetRow: 76,
  }),
  filterPart({
    partNumber: "A-5549",
    brand: "Sakura",
    subCategory: "Air Intake",
    heightMm: 330,
    outerDiameterMm: 105,
    threadSize: "Inner Safety",
    micronRating: "5 Micron",
    crossReferences: {
      CAT: "142-1404",
      Donaldson: "P532502",
      Fleetguard: "AF25558",
      Baldwin: "RS3545",
      Wix: "46563",
    },
    sheetRow: 155,
  }),
  filterPart({
    partNumber: "A-8508",
    brand: "Sakura",
    subCategory: "Air Intake",
    heightMm: 420,
    outerDiameterMm: 208,
    threadSize: "Radial Seal Outer",
    micronRating: "3 Micron",
    crossReferences: {
      CAT: "131-8822",
      Donaldson: "P533882",
      Fleetguard: "AF25288",
      Baldwin: "RS3744",
      Wix: "46822",
    },
    sheetRow: 125,
  }),
  filterPart({
    partNumber: "A-8507",
    brand: "Sakura",
    subCategory: "Air Intake",
    heightMm: 405,
    outerDiameterMm: 142,
    threadSize: "Inner Safety Element",
    micronRating: "5 Micron",
    crossReferences: {
      CAT: "131-8821",
      Donaldson: "P533884",
      Fleetguard: "AF25289",
      Baldwin: "RS3745",
      Wix: "46823",
    },
    sheetRow: 146,
  }),

  // --- Cooling System ---
  filterPart({
    partNumber: "WC-5706",
    brand: "Sakura",
    subCategory: "Cooling System",
    heightMm: 137,
    outerDiameterMm: 93,
    threadSize: "11/16-16 UN-2B",
    micronRating: "SCA Conditioned",
    crossReferences: {
      CAT: "9Y-4528",
      Donaldson: "P554071",
      Fleetguard: "WF2071",
      Baldwin: "BW5071",
      Wix: "24071",
    },
    sheetRow: 128,
  }),
  filterPart({
    partNumber: "WC-5713",
    brand: "Sakura",
    subCategory: "Cooling System",
    heightMm: 137,
    outerDiameterMm: 93,
    threadSize: "11/16-16 UN-2B",
    micronRating: "SCA Conditioned",
    crossReferences: {
      CAT: "111-2370",
      Donaldson: "P554073",
      Fleetguard: "WF2073",
      Baldwin: "BW5073",
      Wix: "24073",
    },
    sheetRow: 128,
  }),
];

function aggregateStandListings() {
  const byPn = new Map<string, { partNumber: string; stands: number[] }>();
  for (const [stand, raw] of FILTER_STAND_LISTINGS) {
    const partNumber = raw.trim();
    if (!partNumber) continue;
    const key = normalizePn(partNumber);
    const prev = byPn.get(key);
    if (prev) {
      if (!prev.stands.includes(stand)) prev.stands.push(stand);
    } else {
      byPn.set(key, { partNumber, stands: [stand] });
    }
  }
  return [...byPn.values()];
}

const standAggregates = aggregateStandListings();
const standAggByKey = new Map(
  standAggregates.map((a) => [normalizePn(a.partNumber), a] as const),
);
const detailedByKey = new Map(
  detailedFilterParts.map((p) => [normalizePn(p.partNumber), p] as const),
);

/** Enrich detailed seeds with stand locations from depot sheets (qty stays 0 until counted). */
const enrichedDetailed: Part[] = detailedFilterParts.map((p) => {
  const agg = standAggByKey.get(normalizePn(p.partNumber));
  if (!agg) return p;
  const stands = [...new Set([...(p.boxNumber != null ? [p.boxNumber] : []), ...agg.stands])].sort(
    (a, b) => a - b,
  );
  return {
    ...p,
    quantity: 0,
    reorderAt: 0,
    boxNumber: stands[0] ?? p.boxNumber,
    notes: [p.notes, `Stands ${stands.join(", ")}`].filter(Boolean).join(" · "),
  };
});

const standOnlyParts: Part[] = standAggregates
  .filter((a) => !detailedByKey.has(normalizePn(a.partNumber)))
  .map((a) =>
    filterPart({
      partNumber: a.partNumber,
      brand: inferBrand(a.partNumber),
      subCategory: inferSubcategory(a.partNumber),
      stands: a.stands,
      sheetRow: a.stands[0],
      quantity: 0,
    }),
  )
  .sort((a, b) => a.partNumber.localeCompare(b.partNumber, undefined, { sensitivity: "base" }));

/** Full Filters catalog: detailed specs + remaining stand-sheet SKUs. */
export const filterParts: Part[] = [...enrichedDetailed, ...standOnlyParts];
