import type { SavedDocument, RecordAccountPaymentInput } from "../components/app/documents-context";
import type { PartyRecord } from "../components/app/parties-context";
import { lineFulfillment } from "./client-report-lines";
import { localTodayIso } from "./date-local";
import { invoiceAmountPaid, invoiceRemaining } from "./invoice-balance";
import { currency, partNumbersOf, type Part } from "./mock-data";
import type { PaymentMethod } from "./document-export";

const WAITING = new Set(["Waiting parts", "Ready"]);
const RECEIVED = new Set(["Delivered", "Picked up"]);

export type ShopChatToolContext = {
  clients: PartyRecord[];
  parts: Part[];
  documents: SavedDocument[];
  invoices: SavedDocument[];
  creditNotes: SavedDocument[];
  addToCart: (part: Part, qty: number) => void;
  recordAccountPayment: (input: RecordAccountPaymentInput) => SavedDocument[];
  recordInvoicePayment: (input: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    paymentDate: string;
    mobile?: string;
  }) => SavedDocument;
  openClient: (clientId: string) => void;
};

function money(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function belongsToClient(
  doc: { partyKind?: string; partyId?: string; partyName: string },
  client: { id: string; name: string },
): boolean {
  if (doc.partyKind && doc.partyKind !== "client") return false;
  if (doc.partyId && doc.partyId === client.id) return true;
  const name = client.name.trim().toLowerCase();
  return Boolean(name) && doc.partyName.trim().toLowerCase() === name;
}

function clientNetDue(client: PartyRecord, ctx: ShopChatToolContext): number {
  let due = 0;
  for (const inv of ctx.invoices) {
    if (inv.kind !== "invoice" || !belongsToClient(inv, client)) continue;
    due += invoiceRemaining(inv, ctx.creditNotes, ctx.documents);
  }
  return money(due);
}

function lineMoney(line: { unitPrice?: number; qty?: number }): number {
  return money((line.unitPrice ?? 0) * (line.qty ?? 0));
}

export function findClientsByName(clients: PartyRecord[], raw: string): PartyRecord[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const scored = clients
    .map((c) => {
      const name = c.name.trim().toLowerCase();
      const contact = (c.contactName ?? "").trim().toLowerCase();
      let score = 0;
      if (name === q || contact === q) score = 100;
      else if (name.startsWith(q) || contact.startsWith(q)) score = 80;
      else if (name.includes(q) || contact.includes(q)) score = 50;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, 8).map((x) => x.c);
}

function requireClient(ctx: ShopChatToolContext, name: string): PartyRecord | { error: string } {
  const hits = findClientsByName(ctx.clients, name);
  if (hits.length === 0) return { error: `No client matching "${name}"` };
  if (hits.length > 1 && hits[0]!.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
    return {
      error: `Several clients match. Pick one: ${hits.map((c) => c.name).join(", ")}`,
    };
  }
  return hits[0]!;
}

function searchParts(parts: Part[], raw: string): Part[] {
  const q = raw.replace(/\s+/g, "").toLowerCase();
  if (!q) return [];
  const out: Part[] = [];
  for (const part of parts) {
    const codes = partNumbersOf(part).map((n) => n.replace(/\s+/g, "").toLowerCase());
    const name = (part.name ?? "").toLowerCase().replace(/\s+/g, "");
    if (codes.some((n) => n.includes(q) || q.includes(n)) || name.includes(q)) {
      out.push(part);
    }
    if (out.length >= 12) break;
  }
  return out;
}

export function runShopChatTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ShopChatToolContext,
): string {
  try {
    const result = runTool(name, args, ctx);
    return JSON.stringify(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool failed";
    return JSON.stringify({ error: message });
  }
}

function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ShopChatToolContext,
): unknown {
  if (name === "who_owes_me") {
    const clients = ctx.clients
      .map((client) => ({
        name: client.name,
        due: clientNetDue(client, ctx),
      }))
      .filter((row) => row.due > 0.005)
      .sort((a, b) => b.due - a.due);
    return {
      count: clients.length,
      totalDue: money(clients.reduce((s, row) => s + row.due, 0)),
      clients: clients.slice(0, 20),
    };
  }

  if (name === "get_client") {
    const found = requireClient(ctx, String(args.name ?? ""));
    if ("error" in found) return found;
    return {
      id: found.id,
      name: found.name,
      contact: found.contactName,
      phone: found.phone,
      promisedPayDate: found.promisedPayDate ?? null,
      netDue: clientNetDue(found, ctx),
    };
  }

  if (name === "get_client_invoices") {
    const found = requireClient(ctx, String(args.name ?? ""));
    if ("error" in found) return found;
    const list = ctx.invoices
      .filter((inv) => belongsToClient(inv, found))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 25)
      .map((inv) => ({
        id: inv.id,
        date: inv.date,
        total: inv.total,
        status: inv.status,
        paid: invoiceAmountPaid(inv, ctx.documents),
        remaining: invoiceRemaining(inv, ctx.creditNotes, ctx.documents),
        fulfillment: inv.fulfillmentStatus ?? null,
      }));
    return { client: found.name, invoices: list };
  }

  if (name === "get_paid_vs_received") {
    const found = requireClient(ctx, String(args.name ?? ""));
    if ("error" in found) return found;
    return paidVsReceived(found, ctx);
  }

  if (name === "search_parts") {
    const hits = searchParts(ctx.parts, String(args.query ?? ""));
    return {
      count: hits.length,
      parts: hits.map((p) => ({
        partNumber: p.partNumber,
        name: p.name,
        qty: p.quantity,
        price: p.price,
        location: p.boxNumber != null ? `box ${p.boxNumber}` : null,
      })),
    };
  }

  if (name === "add_to_cart") {
    const code = String(args.partNumber ?? "").trim();
    const qty = Math.max(1, Math.round(Number(args.qty) || 1));
    const hits = searchParts(ctx.parts, code);
    const exact =
      hits.find((p) =>
        partNumbersOf(p).some((n) => n.replace(/\s+/g, "").toLowerCase() === code.replace(/\s+/g, "").toLowerCase()),
      ) ?? hits[0];
    if (!exact) return { error: `No part matching "${code}"` };
    ctx.addToCart(exact, qty);
    return {
      ok: true,
      partNumber: exact.partNumber,
      name: exact.name,
      qty,
      unitPrice: exact.price,
      line: money(exact.price * qty),
    };
  }

  if (name === "record_payment") {
    const found = requireClient(ctx, String(args.clientName ?? ""));
    if ("error" in found) return found;
    const amount = money(Number(args.amount));
    if (!(amount > 0.005)) return { error: "Amount must be greater than zero" };
    const methodRaw = String(args.method ?? "Cash");
    const method: PaymentMethod =
      methodRaw === "OMT" || methodRaw === "Whish" ? methodRaw : "Cash";
    const mobile = typeof args.mobile === "string" ? args.mobile.trim() : "";
    if (method !== "Cash" && !mobile) {
      return { error: "Mobile number is required for OMT and Whish" };
    }
    const invoiceId = typeof args.invoiceId === "string" ? args.invoiceId.trim() : "";
    const paymentDate = localTodayIso();
    if (invoiceId) {
      const receipt = ctx.recordInvoicePayment({
        invoiceId,
        amount,
        method,
        paymentDate,
        mobile: mobile || undefined,
      });
      return { ok: true, receiptId: receipt.id, amount, method, invoiceId, client: found.name };
    }
    const receipts = ctx.recordAccountPayment({
      clientId: found.id,
      clientName: found.name,
      amount,
      method,
      paymentDate,
      mobile: mobile || undefined,
    });
    return {
      ok: true,
      amount,
      method,
      client: found.name,
      receipts: receipts.map((r) => ({ id: r.id, invoiceId: r.invoiceId, total: r.total })),
    };
  }

  if (name === "open_client") {
    const found = requireClient(ctx, String(args.name ?? ""));
    if ("error" in found) return found;
    ctx.openClient(found.id);
    return { ok: true, opened: found.name, id: found.id };
  }

  return { error: `Unknown tool ${name}` };
}

export function paidVsReceived(client: PartyRecord, ctx: Pick<ShopChatToolContext, "invoices" | "documents" | "creditNotes">) {
  let paidTotal = 0;
  let paidReceived = 0;
  let paidWaiting = 0;
  const receivedBills: Array<{ id: string; date: string; received: number; paid: number }> = [];

  for (const inv of ctx.invoices) {
    if (!belongsToClient(inv, client)) continue;
    const paid = invoiceAmountPaid(inv, ctx.documents);
    if (paid <= 0.005) continue;
    paidTotal += paid;
    let rec = 0;
    let wait = 0;
    for (const line of inv.lines ?? []) {
      const st = lineFulfillment(line, inv);
      const lineTotal = lineMoney(line);
      if (st && WAITING.has(st)) wait += lineTotal;
      else if (st && RECEIVED.has(st)) rec += lineTotal;
    }
    paidReceived += rec;
    paidWaiting += wait;
    if (rec > 0.005) {
      receivedBills.push({ id: inv.id, date: inv.date, received: money(rec), paid: money(paid) });
    }
  }

  return {
    client: client.name,
    paidTotal: money(paidTotal),
    receivedFromPaid: money(paidReceived),
    paidStillWaiting: money(Math.max(0, paidTotal - paidReceived)),
    waitingLineTotalOnPaidBills: money(paidWaiting),
    receivedBills,
    note: "receivedFromPaid counts Delivered/Picked up lines on invoices that already have payment. Unpaid invoices are excluded.",
  };
}

export function formatConfirmPayment(args: Record<string, unknown>): string {
  const name = String(args.clientName ?? "client");
  const amount = currency(Number(args.amount) || 0);
  const method = String(args.method ?? "Cash");
  const invoice = typeof args.invoiceId === "string" && args.invoiceId ? ` on ${args.invoiceId}` : "";
  return `Record ${amount} ${method} for ${name}${invoice}?`;
}
