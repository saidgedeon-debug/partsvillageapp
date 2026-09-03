import { describe, expect, it } from "vitest";

import { roundMoney } from "./document-money";

describe("roundMoney", () => {
  it("rounds to nearest cent", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1);
    expect(roundMoney(10.1 + 0.2)).toBe(10.3);
  });

  it("returns 0 for non-finite values", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
