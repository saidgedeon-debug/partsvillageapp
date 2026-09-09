import { describe, expect, it } from "vitest";

import {
  buildSupplierOrderList,
  closePreOrdersLinkedToInvoices,
  invoiceNoteForPreOrder,
  preOrderIdFromInvoiceNote,
  preOrderIsConverted,
  type CustomerPreOrder,
} from "./preorders";

function order(partial: Partial<CustomerPreOrder> & Pick<CustomerPreOrder, "id">): CustomerPreOrder {
  return {
    clientName: "Acme",
    orderedAt: "2026-01-01",
    total: 100,
    amountPaid: 20,
    lines: [{ partId: "p1", partNumber: "A-1", name: "Valve", qty: 2, unitPrice: 50 }],
    needsProcurement: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("pre-order invoice conversion", () => {
  it("reads the pre-order id from an invoice note", () => {
    expect(preOrderIdFromInvoiceNote("From pre-order po-abc-1 · rush")).toBe("po-abc-1");
    expect(preOrderIdFromInvoiceNote("From pre-order po-abc-1")).toBe("po-abc-1");
    expect(preOrderIdFromInvoiceNote("Unrelated note")).toBeNull();
  });

  it("closes open pre-orders that already have an invoice", () => {
    const open = order({ id: "po-abc-1" });
    const other = order({ id: "po-xyz-2" });
    const closed = closePreOrdersLinkedToInvoices(
      [open, other],
      [
        {
          id: "INV-100",
          kind: "invoice",
          internalNote: invoiceNoteForPreOrder(open),
        },
      ],
      "2026-02-01T00:00:00.000Z",
    );

    expect(preOrderIsConverted(closed[0])).toBe(true);
    expect(closed[0].invoiceId).toBe("INV-100");
    expect(closed[0].needsProcurement).toBe(false);
    expect(closed[1]).toBe(other);
  });

  it("keeps already-converted orders unchanged", () => {
    const converted = order({
      id: "po-abc-1",
      invoiceId: "INV-OLD",
      convertedAt: "2026-01-02T00:00:00.000Z",
      needsProcurement: false,
    });
    const source = [converted];
    const result = closePreOrdersLinkedToInvoices(
      source,
      [{ id: "INV-NEW", kind: "invoice", internalNote: "From pre-order po-abc-1" }],
    );
    expect(result).toBe(source);
    expect(result[0].invoiceId).toBe("INV-OLD");
  });

  it("omits converted pre-orders from the supplier list", () => {
    const items = buildSupplierOrderList([
      order({ id: "po-open" }),
      order({ id: "po-done", invoiceId: "INV-1", convertedAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(items).toEqual([{ partNumber: "A-1", name: "Valve", qty: 2 }]);
  });
});
