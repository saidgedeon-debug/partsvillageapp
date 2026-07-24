import type { Part } from "@/lib/mock-data";

let cached: Part[] | null = null;
let loading: Promise<Part[]> | null = null;

/** Lazy-load catalog seeds (O-rings + Couplings + Gauges + Hydraulics + MISC). */
export function loadCatalogParts(): Promise<Part[]> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = Promise.all([
    import("@/lib/orings-inventory"),
    import("@/lib/couplings-inventory"),
    import("@/lib/gauges-inventory"),
    import("@/lib/hydraulics-inventory"),
    import("@/lib/misc-inventory"),
  ])
    .then(([orings, couplings, gauges, hydraulics, misc]) => {
      cached = [
        ...orings.oringParts,
        ...couplings.couplingParts,
        ...gauges.gaugeParts,
        ...hydraulics.hydraulicParts,
        ...misc.miscParts,
      ];
      return cached;
    })
    .catch((err) => {
      // Allow a later call to retry after a failed chunk load.
      loading = null;
      throw err;
    });

  return loading;
}

/** Clear failed/cached catalog so the next call retries. */
export function resetCatalogPartsCache() {
  cached = null;
  loading = null;
}

export function getCachedCatalogParts(): Part[] | null {
  return cached;
}
