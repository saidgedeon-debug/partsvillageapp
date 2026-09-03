import { describe, expect, it } from "vitest";

import { normalizePhoneE164 } from "./phone";

describe("normalizePhoneE164", () => {
  it("returns null for empty input", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("   ")).toBeNull();
  });

  it("strips non-digits and leading 00", () => {
    expect(normalizePhoneE164("00 961 71 000 000")).toBe("96171000000");
  });

  it("prepends 961 for local Lebanese numbers with leading 0", () => {
    expect(normalizePhoneE164("03 123456")).toBe("9613123456");
    expect(normalizePhoneE164("71 000 000")).toBe("96171000000");
  });

  it("keeps already-international 961 numbers", () => {
    expect(normalizePhoneE164("+96171000000")).toBe("96171000000");
  });

  it("returns null when too short after normalize", () => {
    expect(normalizePhoneE164("12")).toBeNull();
  });
});
