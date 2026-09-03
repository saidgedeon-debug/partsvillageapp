import { describe, expect, it } from "vitest";

import { mergeShopStateValue } from "./shop-state-merge";

describe("mergeShopStateValue numeric delta", () => {
  it("applies local delta on quantity fields", () => {
    expect(mergeShopStateValue(10, 12, 15, "quantity")).toBe(17);
  });

  it("keeps remote when local matches base", () => {
    expect(mergeShopStateValue(10, 10, 15, "quantity")).toBe(15);
  });

  it("keeps local when remote matches base", () => {
    expect(mergeShopStateValue(10, 12, 10, "quantity")).toBe(12);
  });

  it("merges quantity fields inside keyed objects", () => {
    const base = { id: "p1", quantity: 5 };
    const local = { id: "p1", quantity: 7 };
    const remote = { id: "p1", quantity: 9 };
    expect(mergeShopStateValue(base, local, remote)).toEqual({ id: "p1", quantity: 11 });
  });

  it("uses last-writer local for price (no delta sum)", () => {
    const base = { id: "p1", price: 10 };
    const local = { id: "p1", price: 12 };
    const remote = { id: "p1", price: 15 };
    expect(mergeShopStateValue(base, local, remote)).toEqual({ id: "p1", price: 12 });
  });

  it("uses last-writer local for bare numbers without a delta field key", () => {
    expect(mergeShopStateValue(10, 12, 15)).toBe(12);
  });

  it("heals invoice amountPaid from receipts after documents merge", () => {
    const base = {
      documents: [
        { id: "inv-1", kind: "invoice", total: 100, amountPaid: 0, status: "Unpaid" },
      ],
    };
    const local = {
      documents: [
        { id: "inv-1", kind: "invoice", total: 100, amountPaid: 40, status: "Partial" },
        {
          id: "r1",
          kind: "receipt",
          invoiceId: "inv-1",
          total: 40,
          affectsBalance: true,
        },
      ],
    };
    const remote = {
      documents: [
        { id: "inv-1", kind: "invoice", total: 100, amountPaid: 25, status: "Partial" },
        {
          id: "r2",
          kind: "receipt",
          invoiceId: "inv-1",
          total: 25,
          affectsBalance: true,
        },
      ],
    };
    const merged = mergeShopStateValue(base, local, remote) as {
      documents: { id: string; amountPaid?: number }[];
    };
    const inv = merged.documents.find((d) => d.id === "inv-1");
    expect(inv?.amountPaid).toBe(65);
  });
});
