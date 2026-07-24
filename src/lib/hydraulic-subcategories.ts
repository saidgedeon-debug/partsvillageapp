/** Known Hydraulic Parts subtypes — add new labels here as stock lines grow. */
export const HYDRAULIC_SUBCATEGORIES = [
  "Center Pin",
  "Ball Guide",
  "shoe/thrust plate",
  "Valve Plate",
  "retainer / set plate",
  "servo piston",
] as const;

export type HydraulicSubcategory = (typeof HYDRAULIC_SUBCATEGORIES)[number];
