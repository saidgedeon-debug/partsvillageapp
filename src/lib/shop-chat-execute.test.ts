import { describe, expect, it } from "vitest";

import type { SavedDocument } from "../components/app/documents-context";
import type { PartyRecord } from "../components/app/parties-context";
import { findClientsByName, paidVsReceived, runShopChatTool } from "./shop-chat-execute";
import type { ShopChatToolContext } from "./shop-chat-execute";

function client(name: string, id = "cli-1"): PartyRecord {
  return {
    id,
    name,
    contactName: name,
    email: "",
    phone: "",
    address: "",
  };
}

function invoice(partial: Partial<SavedDocument> & Pick<SavedDocument, "id" | "total">): SavedDocument {
  return {
    kind: "invoice",
    partyKind: "client",
    partyId: "cli-1",
    partyName: "RIDA HAMDAN",
    date: "2026-09-10",
    createdAt: "2026-09-10T10:00:00.000Z",
    status: "Paid",
    lines: [],
    ...partial,
  };
}

function ctx(over: Partial<ShopChatToolContext> = {}): ShopChatToolContext {
  return {
    clients: [client("RIDA HAMDAN"), client("georges gedeon and co", "cli-2")],
    parts: [],
    documents: [],
    invoices: [],
    creditNotes: [],
    addToCart: () => {},
    recordAccountPayment: () => [],
    recordInvoicePayment: () =>
      invoice({
        id: "RCP-1",
        total: 1,
        kind: "receipt",
        status: "Paid",
        invoiceId: "INV-1",
      }),
    openClient: () => {},
    ...over,
  };
}

describe("findClientsByName", () => {
  const clients = [client("RIDA HAMDAN"), client("georges gedeon and co", "cli-2")];
  it("matches hamdan", () => {
    expect(findClientsByName(clients, "hamdan").map((c) => c.name)).toEqual(["RIDA HAMDAN"]);
  });
});

describe("paidVsReceived", () => {
  it("counts only delivered lines on paid invoices", () => {
    const paidDelivered = invoice({
      id: "INV-1",
      total: 200,
      amountPaid: 200,
      fulfillmentStatus: "Delivered",
      lines: [
        {
          partId: "p1",
          partNumber: "A",
          name: "A",
          category: "x",
          unitPrice: 200,
          unitCost: 0,
          qty: 1,
          fulfillmentStatus: "Delivered",
        },
      ],
    });
    const paidWaiting = invoice({
      id: "INV-2",
      total: 500,
      amountPaid: 500,
      status: "Paid",
      fulfillmentStatus: "Waiting parts",
      lines: [
        {
          partId: "p2",
          partNumber: "B",
          name: "B",
          category: "x",
          unitPrice: 500,
          unitCost: 0,
          qty: 1,
          fulfillmentStatus: "Waiting parts",
        },
      ],
    });
    const unpaidReceived = invoice({
      id: "INV-3",
      total: 90,
      amountPaid: 0,
      status: "Unpaid",
      lines: [
        {
          partId: "p3",
          partNumber: "SHIP",
          name: "Ship",
          category: "x",
          unitPrice: 90,
          unitCost: 0,
          qty: 1,
          fulfillmentStatus: "Picked up",
        },
      ],
    });
    const documents = [paidDelivered, paidWaiting, unpaidReceived];
    const result = paidVsReceived(client("RIDA HAMDAN"), {
      invoices: documents,
      documents,
      creditNotes: [],
    });
    expect(result.paidTotal).toBe(700);
    expect(result.receivedFromPaid).toBe(200);
    expect(result.paidStillWaiting).toBe(500);
  });
});

describe("runShopChatTool who_owes_me", () => {
  it("returns open dues", () => {
    const inv = invoice({
      id: "INV-DUE",
      total: 485,
      amountPaid: 0,
      status: "Unpaid",
      partyId: "cli-2",
      partyName: "georges gedeon and co",
      lines: [
        {
          partId: "p",
          partNumber: "X",
          name: "X",
          category: "x",
          unitPrice: 485,
          unitCost: 0,
          qty: 1,
        },
      ],
    });
    const out = JSON.parse(
      runShopChatTool(
        "who_owes_me",
        {},
        ctx({
          invoices: [inv],
          documents: [inv],
        }),
      ),
    ) as { count: number; totalDue: number };
    expect(out.count).toBe(1);
    expect(out.totalDue).toBe(485);
  });
});
