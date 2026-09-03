/**
 * Seal subtypes from FINAL new inventory.xlsx (Sheet2 batches + WR / qty sheets).
 * Order follows the Excel catalog sections.
 */
export const SEAL_SUBCATEGORIES = [
  "Wear Ring",
  "SPGW",
  "SPG",
  "Glyd Ring",
  "Slipper Seal",
  "OK Seal",
  "DKBI",
  "DWIR",
  "DWI",
  "HBY",
  "Step Seal",
  "HBTY",
  "HBTZ",
  "HP Seal",
  "ROI",
  "Back Up Ring (U-Ring)",
  "Dust Ring",
  "T3G",
  "T3P",
  "T3AN",
  "N4W",
  "OHM",
  "TCN",
  "PPY",
  "OUY",
  "U-Ring",
  "Nylon Triple Seal",
  "Rubber Triple Seal",
  "Square Pump Ring",
  "Figure-8 Pump Ring",
] as const;

export type SealSubcategory = (typeof SEAL_SUBCATEGORIES)[number];
