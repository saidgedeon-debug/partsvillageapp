/** MISC catalog seed — Parts Village. */
import type { Part } from "@/lib/mock-data";

export const miscParts: Part[] = [
  {
    id: "misc-ec290-muffler-assy",
    partNumber: "EC290-MUFFLER-ASSY",
    partNumbers: ["EC290-MUFFLER-ASSY", "EC290 MUFFLER ASSY"],
    name: "EC290 Muffler Assy",
    description: "Volvo EC290 muffler assembly · FOB cost USD 55 · Sell USD 270",
    category: "MISC",
    quantity: 1,
    reorderAt: 1,
    cost: 55,
    price: 270,
    compatibility: ["Volvo EC290", "Volvo EC290B", "Volvo EC290C"],
    notes: "Category: MISC · Cost FOB USD 55 · Selling USD 270",
  },
  {
    id: "misc-ec290-water-tank-cap",
    partNumber: "EC290-WATER-TANK",
    partNumbers: ["EC290-WATER-TANK", "EC290 WATER TANK WITH CAP"],
    name: "EC290 Water Tank with Cap",
    description: "Volvo EC290 water tank with cap · FOB cost USD 13 · Sell USD 48",
    category: "MISC",
    quantity: 1,
    reorderAt: 1,
    cost: 13,
    price: 48,
    compatibility: ["Volvo EC290", "Volvo EC290B", "Volvo EC290C"],
    notes: "Category: MISC · Cost FOB USD 13 · Selling USD 48",
  },
];
