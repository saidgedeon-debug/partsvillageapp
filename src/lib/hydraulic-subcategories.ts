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
  "Gauges & Accessories",
] as const;

export type HydraulicSubcategory = (typeof HYDRAULIC_SUBCATEGORIES)[number];
