import { describe, expect, it } from "vitest";

import {
  buildClientPartReports,
  isReceivedPartStatus,
  isWaitingPartStatus,
} from "./client-report-lines";
import type { CustomerPreOrder } from "./preorders";

function invoice(partial: Record<string, unknown> & { id: string }) {
  return {
    kind: "invoice",
    partyKind: "client",
    partyId: "c1",
    partyName: "Acme",
    date: "2026-03-01",
    createdAt: "2026-03-01T00:00:00.000Z",
    total: 100,
    status: "Unpaid",
    lines: [],
    ...partial,
  } as Parameters<typeof buildClientPartReports>[1][number];
}

describe("client part reports", () => {
  it("treats unmarked lines as received and waiting/ready as still waiting", () => {
    expect(isReceivedPartStatus(undefined)).toBe(true);
    expect(isReceivedPartStatus("Picked up")).toBe(true);
    expect(isReceivedPartStatus("Waiting parts")).toBe(false);
    expect(isWaitingPartStatus("Ready")).toBe(true);
    expect(isWaitingPartStatus(undefined)).toBe(false);
  });

  it("splits invoice lines and open pre-orders", () => {
    const invoices = [
      invoice({
        id: "INV-1",
        lines: [
          {
            partId: "a",
            partNumber: "A-1",
            name: "Valve",
            category: "Hyd",
            unitPrice: 10,
            unitCost: 4,
            qty: 2,
            fulfillmentStatus: "Picked up",
          },
          {
            partId: "b",
            partNumber: "B-2",
            name: "Hose",
            category: "Hyd",
            unitPrice: 8,
            unitCost: 3,
            qty: 1,
            fulfillmentStatus: "Waiting parts",
          },
        ],
      }),
    ];
    const preOrders: CustomerPreOrder[] = [
      {
        id: "po-1",
        clientId: "c1",
        clientName: "Acme",
        orderedAt: "2026-04-01",
        total: 50,
        amountPaid: 0,
        needsProcurement: true,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        lines: [{ partId: "c", partNumber: "C-3", name: "Sensor", qty: 3, unitPrice: 20 }],
      },
    ];
    const { received, waiting } = buildClientPartReports(
      { id: "c1", name: "Acme" },
      invoices,
      preOrders,
    );
    expect(received.map((r) => r.partNumber)).toEqual(["A-1"]);
    expect(waiting.map((r) => r.partNumber).sort()).toEqual(["B-2", "C-3"]);
    expect(waiting.find((r) => r.partNumber === "C-3")?.status).toBe("Waiting abroad");
  });
});
