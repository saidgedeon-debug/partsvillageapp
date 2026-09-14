import { describe, expect, it } from "vitest";

import { healDuplicateConvertedDocuments } from "./document-duplicate-heal";
import { invoiceIdFromQuotationId } from "./document-source";
import { healDocumentsAmountPaid } from "./document-money-heal";

describe("invoiceIdFromQuotationId", () => {
  it("reuses the quotation timestamp so two devices mint the same invoice code", () => {
    expect(invoiceIdFromQuotationId("Q-20260824-105506353-rao7")).toBe(
      "INV-20260824-105506353-rao7",
    );
  });
});

describe("healDuplicateConvertedDocuments", () => {
  it("keeps one invoice per converted quotation and moves receipts onto it", () => {
    const docs = [
      {
        id: "INV-B",
        kind: "invoice",
        total: 985,
        amountPaid: 499.99,
        status: "Partial",
        internalNote: "Converted from quotation Q-1",
      },
      {
        id: "INV-A",
        kind: "invoice",
        total: 985,
        amountPaid: 500,
        status: "Partial",
        stockDeducted: true,
        internalNote: "Converted from quotation Q-1",
      },
      { id: "R1", kind: "receipt", invoiceId: "INV-A", total: 500, affectsBalance: true },
      { id: "R2", kind: "receipt", invoiceId: "INV-B", total: 499.99, affectsBalance: true },
    ];
    const healed = healDocumentsAmountPaid(docs) as Array<Record<string, unknown>>;
    const invoices = healed.filter((d) => d.kind === "invoice");
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.id).toBe("INV-A");
    expect(invoices[0]?.amountPaid).toBe(999.99);
    expect(invoices[0]?.status).toBe("Paid");
    expect(healed.filter((d) => d.kind === "receipt").map((d) => d.invoiceId)).toEqual([
      "INV-A",
      "INV-A",
    ]);
  });

  it("keeps one invoice per pre-order source", () => {
    const healed = healDuplicateConvertedDocuments([
      {
        id: "INV-1",
        kind: "invoice",
        total: 780,
        internalNote: "From pre-order po-abc · note",
      },
      {
        id: "INV-2",
        kind: "invoice",
        total: 780,
        stockDeducted: true,
        internalNote: "From pre-order po-abc · note",
      },
    ]) as Array<{ id: string }>;
    expect(healed.map((d) => d.id)).toEqual(["INV-2"]);
  });
});
