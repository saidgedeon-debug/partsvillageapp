/** Parts created mid-quotation/invoice this browser session (for stock sync on invoice save). */
const createdPartIds = new Set<string>();

export function markDocumentCreatedPart(partId: string) {
  createdPartIds.add(partId);
}

export function isDocumentCreatedPart(partId: string): boolean {
  return createdPartIds.has(partId);
}

export function clearDocumentCreatedParts() {
  createdPartIds.clear();
}
