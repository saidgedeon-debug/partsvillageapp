export type FulfillmentStatus = "Waiting parts" | "Ready" | "Delivered" | "Picked up";

export const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  "Waiting parts",
  "Ready",
  "Delivered",
  "Picked up",
];

/** Prefer line-level statuses; fall back to document-level. */
export function effectiveFulfillment(doc: {
  fulfillmentStatus?: FulfillmentStatus;
  lines?: Array<{ fulfillmentStatus?: FulfillmentStatus }>;
}): FulfillmentStatus | undefined {
  const lines = doc.lines ?? [];
  if (lines.some((l) => l.fulfillmentStatus)) {
    return deriveDocFulfillment(lines);
  }
  return doc.fulfillmentStatus;
}

/**
 * Mixed line statuses → "Waiting parts" (not fully ready).
 * All same → that status. None set → undefined.
 */
export function deriveDocFulfillment(
  lines: Array<{ fulfillmentStatus?: FulfillmentStatus }>,
): FulfillmentStatus | undefined {
  const set = new Set(
    lines.map((l) => l.fulfillmentStatus).filter(Boolean) as FulfillmentStatus[],
  );
  if (set.size === 0) return undefined;
  if (set.size === 1) return [...set][0];
  // Prefer "Waiting parts" if any line still waiting; else "Ready" if any ready; else mixed → Waiting
  if (set.has("Waiting parts")) return "Waiting parts";
  if (set.has("Ready")) return "Ready";
  return "Waiting parts";
}

export function fulfillmentIsMixed(
  lines: Array<{ fulfillmentStatus?: FulfillmentStatus }>,
): boolean {
  const set = new Set(
    lines.map((l) => l.fulfillmentStatus).filter(Boolean) as FulfillmentStatus[],
  );
  return set.size > 1;
}
