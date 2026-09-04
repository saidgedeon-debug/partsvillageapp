import type { SavedDocument } from "@/components/app/documents-context";

export type PartPriceEvent = {
  documentId: string;
  date: string;
  partyName: string;
  kind: "sale" | "quote" | "cost";
  amount: number;
  qty: number;
};

export function partPriceHistory(
  partId: string,
  partNumber: string,
  documents: SavedDocument[],
): PartPriceEvent[] {
  const number = partNumber.trim().toLowerCase();
  return documents
    .flatMap((document) =>
      document.lines
        .filter((line) => line.partId === partId || line.partNumber.trim().toLowerCase() === number)
        .map((line): PartPriceEvent => ({
          documentId: document.id,
          date: document.date,
          partyName: document.partyName,
          kind:
            document.kind === "inquiry" ? "cost" : document.kind === "quotation" ? "quote" : "sale",
          amount: document.kind === "inquiry" ? line.unitCost || 0 : line.unitPrice || 0,
          qty: line.qty,
        })),
    )
    .filter((event) => event.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.documentId.localeCompare(a.documentId));
}

/** Most recent invoice unit price this client paid for the part. */
export function lastClientSalePrice(
  partId: string,
  partNumber: string,
  invoices: SavedDocument[],
  party?: { id?: string; name?: string },
): PartPriceEvent | undefined {
  const partyId = party?.id?.trim();
  const partyName = party?.name?.trim().toLowerCase();
  if (!partyId && !partyName) return undefined;
  const scoped = invoices.filter((doc) => {
    if (doc.kind !== "invoice") return false;
    if (partyId && doc.partyId === partyId) return true;
    if (partyName && doc.partyName.trim().toLowerCase() === partyName) return true;
    return false;
  });
  return partPriceHistory(partId, partNumber, scoped).find((e) => e.kind === "sale");
}
