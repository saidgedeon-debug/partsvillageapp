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
});
