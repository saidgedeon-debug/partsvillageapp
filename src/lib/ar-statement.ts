import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  invoiceAmountPaid,
  invoiceRemaining,
  type SavedDocument,
} from "@/components/app/documents-context";
import type { PartyRecord } from "@/components/app/parties-context";
import { currency } from "@/lib/mock-data";

export type ArStatement = {
  invoices: SavedDocument[];
  current: number;
  days31To60: number;
  days61Plus: number;
  total: number;
};

export function buildArStatement(
  clientId: string,
  invoices: SavedDocument[],
  now = new Date(),
): ArStatement {
  const rows = invoices
    .filter((invoice) => invoice.partyId === clientId && invoiceRemaining(invoice) > 0.005)
    .sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  let days31To60 = 0;
  let days61Plus = 0;
  for (const invoice of rows) {
    const age = Math.max(
      0,
      Math.floor((now.getTime() - new Date(`${invoice.date}T00:00:00`).getTime()) / 86_400_000),
    );
    const remaining = invoiceRemaining(invoice);
    if (age <= 30) current += remaining;
    else if (age <= 60) days31To60 += remaining;
    else days61Plus += remaining;
  }
  return {
    invoices: rows,
    current,
    days31To60,
    days61Plus,
    total: current + days31To60 + days61Plus,
  };
}

export function statementText(client: PartyRecord, statement: ArStatement): string {
  const rows = statement.invoices.map(
    (invoice) =>
      `${invoice.id} · ${invoice.date} · Total ${currency(invoice.total)} · Paid ${currency(invoiceAmountPaid(invoice))} · Due ${currency(invoiceRemaining(invoice))}`,
  );
  return [
    `Hello ${client.contactName || client.name},`,
    "",
    "Parts Village account statement",
    ...rows,
    "",
    `Current: ${currency(statement.current)}`,
    `31–60 days: ${currency(statement.days31To60)}`,
    `61+ days: ${currency(statement.days61Plus)}`,
    `Total due: ${currency(statement.total)}`,
  ].join("\n");
}

export function openStatementWhatsApp(client: PartyRecord, statement: ArStatement) {
  const phone = client.phone.replace(/\D/g, "");
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  window.open(
    `${base}?text=${encodeURIComponent(statementText(client, statement))}`,
    "_blank",
    "noopener,noreferrer",
  );
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
    head: [["Invoice", "Date", "Total", "Paid", "Due"]],
    body: statement.invoices.map((invoice) => [
      invoice.id,
      invoice.date,
      currency(invoice.total),
      currency(invoiceAmountPaid(invoice)),
      currency(invoiceRemaining(invoice)),
    ]),
  });
  const finalY =
    (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total due: ${currency(statement.total)}`, 14, finalY + 12);
  pdf.save(`statement-${client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
