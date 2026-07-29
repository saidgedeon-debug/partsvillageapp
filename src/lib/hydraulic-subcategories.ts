/** Known Hydraulic Parts subtypes — add new labels here as stock lines grow. */
export const HYDRAULIC_SUBCATEGORIES = [
  "Center Pin",
  "Ball Guide",
  "shoe/thrust plate",
  "piston shoe",
  "Valve Plate",
  "retainer / set plate",
  "servo piston",
  "cylinder block",
  "Rotary Groups & Blocks",
  "Manifolds & Blocks",
  "gears and shafts",
  "gear / pilot pump",
  "drive shafts",
  "regulators",
  "valves",
  "misc",
  "Complete Assemblies & Motors",
  "Gauges & Accessories",
] as const;

export type HydraulicSubcategory = (typeof HYDRAULIC_SUBCATEGORIES)[number];
