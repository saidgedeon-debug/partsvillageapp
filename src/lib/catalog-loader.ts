import type { Part } from "@/lib/mock-data";

let cached: Part[] | null = null;
let loading: Promise<Part[]> | null = null;

/** Lazy-load catalog seeds (O-rings + Seals + Couplings + Gauges + Hydraulics + Bearings + Filters + MISC). */
export function loadCatalogParts(): Promise<Part[]> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = Promise.all([
    import("@/lib/orings-inventory"),
    import("@/lib/seals-inventory"),
    import("@/lib/couplings-inventory"),
    import("@/lib/gauges-inventory"),
    import("@/lib/hydraulics-inventory"),
    import("@/lib/bearings-inventory"),
    import("@/lib/filters-inventory"),
    import("@/lib/misc-inventory"),
  ])
    .then(([orings, seals, couplings, gauges, hydraulics, bearings, filters, misc]) => {
      cached = [
        ...orings.oringParts,
        ...seals.sealParts,
        ...couplings.couplingParts,
        ...gauges.gaugeParts,
        ...hydraulics.hydraulicParts,
        ...bearings.bearingParts,
        ...filters.filterParts,
        ...misc.miscParts,
      ].filter((p): p is Part => Boolean(p?.id));
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
