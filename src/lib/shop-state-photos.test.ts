import { describe, expect, it } from "vitest";

import { sanitizeShopStateJson, stripInlineDataUrls } from "./shop-state-photos";

describe("sanitizeShopStateJson", () => {
  it("strips null bytes that Postgres jsonb rejects", () => {
    const docs = [{ id: "n1", note: "ok\u0000bad" }];
    expect(sanitizeShopStateJson(docs)).toEqual([{ id: "n1", note: "okbad" }]);
  });
});

describe("stripInlineDataUrls", () => {
  it("drops data URLs from document photo arrays so invoices can still sync", () => {
    const docs = [
      {
        id: "cn-1",
        imageUrls: ["data:image/jpeg;base64,abc", "https://cdn.example/a.jpg"],
      },
    ];
    expect(stripInlineDataUrls(docs)).toEqual([
      { id: "cn-1", imageUrls: ["https://cdn.example/a.jpg"] },
    ]);
  });
});
