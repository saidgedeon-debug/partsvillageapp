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
