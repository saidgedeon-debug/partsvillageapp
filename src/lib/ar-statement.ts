import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  invoiceAmountPaid,
  invoiceRemaining,
  type SavedDocument,
} from "@/components/app/documents-context";
import type { PartyRecord } from "@/components/app/parties-context";
import { currency } from "@/lib/mock-data";

export type ArBucket = "current" | "days31To60" | "days61Plus";

export type ArInvoiceRow = {
  invoice: SavedDocument;
  remaining: number;
  ageDays: number;
  bucket: ArBucket;
};

export type ArStatement = {
  invoices: SavedDocument[];
  rows: ArInvoiceRow[];
  current: number;
  days31To60: number;
  days61Plus: number;
  total: number;
};

export function invoiceAgeDays(invoiceDate: string, now = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(`${invoiceDate}T00:00:00`).getTime()) / 86_400_000),
  );
}

export function bucketForAge(ageDays: number): ArBucket {
  if (ageDays <= 30) return "current";
  if (ageDays <= 60) return "days31To60";
  return "days61Plus";
}

export function buildArStatement(
  clientId: string,
  invoices: SavedDocument[],
  creditNotes: SavedDocument[] = [],
  now = new Date(),
): ArStatement {
  const rows: ArInvoiceRow[] = invoices
    .filter(
      (invoice) =>
        invoice.partyId === clientId && invoiceRemaining(invoice, creditNotes) > 0.005,
    )
    .map((invoice) => {
      const ageDays = invoiceAgeDays(invoice.date, now);
      return {
        invoice,
        remaining: invoiceRemaining(invoice, creditNotes),
        ageDays,
        bucket: bucketForAge(ageDays),
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays || a.invoice.date.localeCompare(b.invoice.date));

  let current = 0;
  let days31To60 = 0;
  let days61Plus = 0;
  for (const row of rows) {
    if (row.bucket === "current") current += row.remaining;
    else if (row.bucket === "days31To60") days31To60 += row.remaining;
    else days61Plus += row.remaining;
  }
  return {
    invoices: rows.map((row) => row.invoice),
    rows,
    current,
    days31To60,
    days61Plus,
    total: current + days31To60 + days61Plus,
  };
}

export type ClientArSummary = {
  client: PartyRecord;
  statement: ArStatement;
};

/** Clients with open AR, oldest / largest overdue first. */
export function buildClientsArQueue(
  clients: PartyRecord[],
  invoices: SavedDocument[],
  creditNotes: SavedDocument[] = [],
  now = new Date(),
): ClientArSummary[] {
  return clients
    .map((client) => ({
      client,
      statement: buildArStatement(client.id, invoices, creditNotes, now),
    }))
    .filter((row) => row.statement.total > 0.005)
    .sort(
      (a, b) =>
        b.statement.days61Plus - a.statement.days61Plus ||
        b.statement.days31To60 - a.statement.days31To60 ||
        b.statement.total - a.statement.total,
    );
}

export function statementText(client: PartyRecord, statement: ArStatement): string {
  const rows = statement.rows.map(
    (row) =>
      `${row.invoice.id} · ${row.invoice.date} · ${row.ageDays}d · Due ${currency(row.remaining)}`,
  );
  return [
    `Hello ${client.contactName || client.name},`,
    "",
    "Parts Village account statement",
    ...rows,
    "",
    `0–30 days: ${currency(statement.current)}`,
    `31–60 days: ${currency(statement.days31To60)}`,
    `61+ days: ${currency(statement.days61Plus)}`,
    `Total due: ${currency(statement.total)}`,
    "",
    "Please arrange payment at your earliest convenience. Thank you.",
  ].join("\n");
}

export function overdueReminderText(client: PartyRecord, statement: ArStatement): string {
  const overdue = statement.rows.filter((row) => row.bucket !== "current");
  const focus = overdue.length ? overdue : statement.rows;
  const lines = focus.map(
    (row) => `${row.invoice.id} · ${row.ageDays} days overdue · ${currency(row.remaining)}`,
  );
  return [
    `Hello ${client.contactName || client.name},`,
    "",
    "Friendly reminder from Parts Village — the following invoices are past due:",
    ...lines,
    "",
    `Total overdue: ${currency((statement.days31To60 + statement.days61Plus) || statement.total)}`,
    "Please let us know if you need a copy of any invoice. Thank you.",
  ].join("\n");
}

function openWhatsAppText(client: PartyRecord, text: string) {
  const phone = client.phone.replace(/\D/g, "");
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function openStatementWhatsApp(client: PartyRecord, statement: ArStatement) {
  openWhatsAppText(client, statementText(client, statement));
}

export function openOverdueWhatsApp(client: PartyRecord, statement: ArStatement) {
  openWhatsAppText(client, overdueReminderText(client, statement));
}

export function downloadStatementPdf(client: PartyRecord, statement: ArStatement) {
  const pdf = new jsPDF();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("PARTS VILLAGE", 14, 18);
  pdf.setFontSize(13);
  pdf.text("Account statement", 14, 29);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Client: ${client.name}`, 14, 38);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44);
  autoTable(pdf, {
    startY: 51,
    head: [["Invoice", "Date", "Age", "Total", "Paid", "Due"]],
    body: statement.rows.map((row) => [
      row.invoice.id,
      row.invoice.date,
      `${row.ageDays}d`,
      currency(row.invoice.total),
      currency(invoiceAmountPaid(row.invoice)),
      currency(row.remaining),
    ]),
  });
  const finalY =
    (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total due: ${currency(statement.total)}`, 14, finalY + 12);
  pdf.save(`statement-${client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}

