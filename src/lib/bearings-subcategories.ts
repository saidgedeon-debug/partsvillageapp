/** Bearing type labels for inventory category description / filters. */
export const BEARING_SUBCATEGORIES = [
  "Tapered Roller",
  "Cylindrical Roller",
  "Deep Groove Ball",
  "Needle Roller (Double)",
  "Tapered Roller Set",
  "Spherical Roller",
] as const;

export type BearingSubcategory = (typeof BEARING_SUBCATEGORIES)[number];
