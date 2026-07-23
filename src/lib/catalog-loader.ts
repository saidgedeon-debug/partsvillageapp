import type { Part } from "@/lib/mock-data";

let cached: Part[] | null = null;
let loading: Promise<Part[]> | null = null;

/** Lazy-load catalog seeds (O-rings + Couplings). */
export function loadCatalogParts(): Promise<Part[]> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = Promise.all([
    import("@/lib/orings-inventory"),
    import("@/lib/couplings-inventory"),
  ]).then(([orings, couplings]) => {
    cached = [...orings.oringParts, ...couplings.couplingParts];
    return cached;
  });

  return loading;
}

export function getCachedCatalogParts(): Part[] | null {
  return cached;
}
