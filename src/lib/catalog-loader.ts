import type { Part } from "@/lib/mock-data";

let cached: Part[] | null = null;
let loading: Promise<Part[]> | null = null;

/** Lazy-load only the O-ring catalog for now. */
export function loadCatalogParts(): Promise<Part[]> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = import("@/lib/orings-inventory").then((orings) => {
    cached = [...orings.oringParts];
    return cached;
  });

  return loading;
}

export function getCachedCatalogParts(): Part[] | null {
  return cached;
}
