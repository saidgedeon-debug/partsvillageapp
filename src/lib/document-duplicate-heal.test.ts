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
  it("keeps one invoice and does not stack the same first payment twice", () => {
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
      {
        id: "R1",
        kind: "receipt",
        invoiceId: "INV-A",
        total: 500,
        affectsBalance: true,
        paymentDate: "2026-09-10",
        invoiceRemainingAfter: 485,
      },
      {
        id: "R2",
        kind: "receipt",
        invoiceId: "INV-B",
        total: 499.99,
        affectsBalance: true,
        paymentDate: "2026-09-10",
        invoiceRemainingAfter: 485.01,
      },
    ];
    const healed = healDocumentsAmountPaid(docs) as Array<Record<string, unknown>>;
    const invoices = healed.filter((d) => d.kind === "invoice");
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.id).toBe("INV-A");
    expect(invoices[0]?.amountPaid).toBe(500);
    expect(invoices[0]?.status).toBe("Partial");
    const receipts = healed.filter((d) => d.kind === "receipt");
    expect(receipts.map((d) => d.invoiceId)).toEqual(["INV-A", "INV-A"]);
    expect(receipts.filter((d) => d.affectsBalance !== false)).toHaveLength(1);
  });

  it("unsticks two first-payment receipts already sitting on one merged invoice", () => {
    const healed = healDocumentsAmountPaid([
      {
        id: "INV-A",
        kind: "invoice",
        total: 985,
        amountPaid: 999.99,
        status: "Paid",
        internalNote: "Converted from quotation Q-1",
      },
      {
        id: "R1",
        kind: "receipt",
        invoiceId: "INV-A",
        total: 500,
        affectsBalance: true,
        paymentDate: "2026-09-10",
        createdAt: "2026-09-10T06:26:17.610Z",
        invoiceRemainingAfter: 485,
      },
      {
        id: "R2",
        kind: "receipt",
        invoiceId: "INV-A",
        total: 499.99,
        affectsBalance: true,
        paymentDate: "2026-09-10",
        createdAt: "2026-09-10T10:45:22.486Z",
        invoiceRemainingAfter: 485.01,
      },
    ]) as Array<Record<string, unknown>>;
    const inv = healed.find((d) => d.id === "INV-A");
    expect(inv?.amountPaid).toBe(500);
    expect(inv?.status).toBe("Partial");
    expect(healed.find((d) => d.id === "R1")?.affectsBalance).not.toBe(false);
    expect(healed.find((d) => d.id === "R2")?.affectsBalance).toBe(false);
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
