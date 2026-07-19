import type { Part } from "@/lib/mock-data";

let cached: Part[] | null = null;
let loading: Promise<Part[]> | null = null;

/** Lazy-load Kafu + O-ring catalogs (code-split out of the main bundle). */
export function loadCatalogParts(): Promise<Part[]> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = Promise.all([
    import("@/lib/orings-inventory"),
    import("@/lib/kafu-inventory"),
  ]).then(([orings, kafu]) => {
    cached = [...orings.oringParts, ...kafu.kafuParts];
    return cached;
  });

  return loading;
}

export function getCachedCatalogParts(): Part[] | null {
  return cached;
}
