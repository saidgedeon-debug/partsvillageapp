import { describe, expect, it } from "vitest";

import { formatCloudError, isRetryableCloudError, sameInstant } from "./cloud-error";

describe("formatCloudError", () => {
  it("reads a plain PostgREST-shaped object", () => {
    expect(
      formatCloudError(
        { message: "TypeError: Failed to fetch", code: "", details: "", hint: "" },
        "Failed to save documents",
      ),
    ).toBe("TypeError: Failed to fetch");
  });

  it("falls back when the thrown value has no message", () => {
    expect(formatCloudError({ foo: 1 }, "Failed to save documents")).toBe(
      "Failed to save documents",
    );
  });
});

describe("sameInstant", () => {
  it("treats Z and +00:00 as the same revision", () => {
    expect(sameInstant("2026-09-15T08:06:09.956Z", "2026-09-15T08:06:09.956+00:00")).toBe(
      true,
    );
  });
});

describe("isRetryableCloudError", () => {
  it("retries fetch failures", () => {
    expect(isRetryableCloudError({ message: "TypeError: Failed to fetch" })).toBe(true);
  });
});
