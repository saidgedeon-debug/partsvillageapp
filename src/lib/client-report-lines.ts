import type { FulfillmentStatus } from "./fulfillment";
import { preOrderIsConverted, type CustomerPreOrder } from "./preorders";

export type ReportParty = { id: string; name: string };

export type ReportInvoice = {
  id: string;
  kind?: string;
  partyKind?: string;
  partyId?: string;
  partyName: string;
  date: string;
  fulfillmentStatus?: FulfillmentStatus;
  lines?: Array<{
    partNumber: string;
    name?: string;
    qty: number;
    fulfillmentStatus?: FulfillmentStatus;
  }>;
};

export type ClientPartLine = {
  source: string;
  date: string;
  partNumber: string;
  name: string;
  qty: number;
  status: string;
};

const RECEIVED: ReadonlySet<FulfillmentStatus> = new Set(["Delivered", "Picked up"]);
const WAITING: ReadonlySet<FulfillmentStatus> = new Set(["Waiting parts", "Ready"]);

function belongsToClient(
  doc: { partyKind?: string; partyId?: string; partyName: string },
  client: ReportParty,
): boolean {
  if (doc.partyKind && doc.partyKind !== "client") return false;
  if (doc.partyId) return doc.partyId === client.id;
  const name = client.name.trim().toLowerCase();
  return Boolean(name) && doc.partyName.trim().toLowerCase() === name;
}

export function lineFulfillment(
  line: { fulfillmentStatus?: FulfillmentStatus },
  invoice: { fulfillmentStatus?: FulfillmentStatus },
): FulfillmentStatus | undefined {
  return line.fulfillmentStatus ?? invoice.fulfillmentStatus;
}

/** Delivered / picked up, or unmarked lines (already given unless flagged waiting). */
export function isReceivedPartStatus(status?: FulfillmentStatus): boolean {
  if (!status) return true;
  return RECEIVED.has(status);
}

/** Waiting at supplier / ready in shop — client has not received yet. */
export function isWaitingPartStatus(status?: FulfillmentStatus): boolean {
  return Boolean(status && WAITING.has(status));
}

export function buildClientPartReports(
  client: ReportParty,
  invoices: ReportInvoice[],
  preOrders: CustomerPreOrder[] = [],
): { received: ClientPartLine[]; waiting: ClientPartLine[] } {
  const received: ClientPartLine[] = [];
  const waiting: ClientPartLine[] = [];

  for (const invoice of invoices) {
    if (invoice.kind !== "invoice" || !belongsToClient(invoice, client)) continue;
    for (const line of invoice.lines ?? []) {
      if (!line.partNumber?.trim() || !(line.qty > 0)) continue;
      const status = lineFulfillment(line, invoice);
      const row: ClientPartLine = {
        source: invoice.id,
        date: invoice.date,
        partNumber: line.partNumber.trim(),
        name: (line.name || line.partNumber).trim(),
        qty: Math.max(0, Math.round(line.qty) || 0),
        status: status ?? "Received",
      };
      if (isWaitingPartStatus(status)) waiting.push(row);
      else if (isReceivedPartStatus(status)) received.push(row);
    }
  }

  for (const order of preOrders) {
    if (preOrderIsConverted(order)) continue;
    const matches =
      (order.clientId && order.clientId === client.id) ||
      order.clientName.trim().toLowerCase() === client.name.trim().toLowerCase();
    if (!matches) continue;
    for (const line of order.lines ?? []) {
      if (!line.partNumber?.trim() || !(line.qty > 0)) continue;
      waiting.push({
        source: `Pre-order ${order.id}`,
        date: order.orderedAt,
        partNumber: line.partNumber.trim(),
        name: (line.name || line.partNumber).trim(),
        qty: Math.max(0, Math.round(line.qty) || 0),
        status: order.needsProcurement ? "Waiting abroad" : "Waiting",
      });
    }
  }

  const byDate = (a: ClientPartLine, b: ClientPartLine) =>
    b.date.localeCompare(a.date) || a.partNumber.localeCompare(b.partNumber);
  received.sort(byDate);
  waiting.sort(byDate);
  return { received, waiting };
}
