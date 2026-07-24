import type { Part } from "@/lib/mock-data";

let cached: Part[] | null = null;
let loading: Promise<Part[]> | null = null;

/** Lazy-load catalog seeds (O-rings + Couplings + Gauges + Hydraulics). */
export function loadCatalogParts(): Promise<Part[]> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = Promise.all([
    import("@/lib/orings-inventory"),
    import("@/lib/couplings-inventory"),
    import("@/lib/gauges-inventory"),
    import("@/lib/hydraulics-inventory"),
  ]).then(([orings, couplings, gauges, hydraulics]) => {
    cached = [
      ...orings.oringParts,
      ...couplings.couplingParts,
      ...gauges.gaugeParts,
      ...hydraulics.hydraulicParts,
    ];
    return cached;
  });

  return loading;
}

export function getCachedCatalogParts(): Part[] | null {
  return cached;
}
