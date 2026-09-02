import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  invoiceAmountPaid,
  invoiceCredits,
  invoiceRefundOwed,
  invoiceRemaining,
  type SavedDocument,
} from "@/components/app/documents-context";
import type { PartyRecord } from "@/components/app/parties-context";
import { currency } from "@/lib/mock-data";
import { roundMoney } from "@/lib/document-money";
import {
  ensurePdfArabicFont,
  hasArabic,
  pdfDrawText,
  renderArabicPng,
} from "@/lib/pdf-fonts";

export type ArBucket = "current" | "days31To60" | "days61Plus";

export type ArInvoiceRow = {
  invoice: SavedDocument;
  remaining: number;
  paid: number;
  credits: number;
  ageDays: number;
  bucket: ArBucket;
};

export type ArStatement = {
  invoices: SavedDocument[];
  rows: ArInvoiceRow[];
  /** Credit notes for this client (returns + discounts). */
  creditNotes: SavedDocument[];
  creditsTotal: number;
  /** Sum of paid+credits above invoice totals (refund / credit balance owed to client). */
  refundOwed: number;
  /** Credit notes with no invoice link (overpayments parked on account). */
  unappliedCredits: number;
  /** Open invoice AR minus unapplied on-account credits (not below zero). */
  netDue: number;
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

export function documentBelongsToClient(
  doc: { partyKind?: string; partyId?: string; partyName: string },
  client: { id: string; name: string },
): boolean {
  if (doc.partyKind && doc.partyKind !== "client") return false;
  if (doc.partyId) return doc.partyId === client.id;
  const name = client.name.trim().toLowerCase();
  return Boolean(name) && doc.partyName.trim().toLowerCase() === name;
}

export function buildArStatement(
  client: { id: string; name: string } | string,
  invoices: SavedDocument[],
  creditNotes: SavedDocument[] = [],
  now = new Date(),
): ArStatement {
  const party =
    typeof client === "string" ? { id: client, name: "" } : client;
  const belongs = (doc: SavedDocument) =>
    party.name
      ? documentBelongsToClient(doc, party)
      : doc.partyId === party.id;

  const clientCredits = creditNotes
    .filter((cn) => cn.kind === "credit_note" && belongs(cn))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const rows: ArInvoiceRow[] = invoices
    .filter(
      (invoice) =>
        belongs(invoice) && invoiceRemaining(invoice, creditNotes) > 0.005,
    )
    .map((invoice) => {
      const ageDays = invoiceAgeDays(invoice.date, now);
      return {
        invoice,
        remaining: invoiceRemaining(invoice, creditNotes),
        paid: invoiceAmountPaid(invoice),
        credits: invoiceCredits(invoice, creditNotes),
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

  const creditsTotal = clientCredits.reduce(
    (s, cn) => s + (Number.isFinite(cn.total) ? cn.total : 0),
    0,
  );

  const refundOwed = invoices
    .filter((invoice) => belongs(invoice))
    .reduce((s, invoice) => s + invoiceRefundOwed(invoice, creditNotes), 0);

  const unappliedCredits = roundMoney(
    clientCredits
      .filter((cn) => !cn.invoiceId)
      .reduce((s, cn) => s + (Number.isFinite(cn.total) ? cn.total : 0), 0),
  );
  const total = roundMoney(current + days31To60 + days61Plus);
  const netDue = Math.max(0, roundMoney(total - unappliedCredits));

  return {
    invoices: rows.map((row) => row.invoice),
    rows,
    creditNotes: clientCredits,
    creditsTotal,
    refundOwed,
    unappliedCredits,
    netDue,
    current,
    days31To60,
    days61Plus,
    total,
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
      statement: buildArStatement(client, invoices, creditNotes, now),
    }))
    .filter((row) => row.statement.netDue > 0.005)
    .sort(
      (a, b) =>
        b.statement.days61Plus - a.statement.days61Plus ||
        b.statement.days31To60 - a.statement.days31To60 ||
        b.statement.netDue - a.statement.netDue,
    );
}

function creditLabel(cn: SavedDocument): string {
  const isDiscount =
    cn.discountType === "amount" ||
    cn.lines.some((l) => l.partNumber === "DISCOUNT" || l.category === "Discount");
  if (isDiscount) return "Discount";
  return "Return";
}

export function statementText(
  client: PartyRecord,
  statement: ArStatement,
  opts?: { promisedPayDate?: string },
): string {
  const promised = (opts?.promisedPayDate ?? client.promisedPayDate)?.trim();
  const rows = statement.rows.map(
    (row) =>
      `${row.invoice.id} · ${row.invoice.date} · ${row.ageDays}d · Due ${currency(row.remaining)}${
        row.credits > 0.005 ? ` (credits −${currency(row.credits)})` : ""
      }`,
  );
  const credits = statement.creditNotes.slice(0, 12).map(
    (cn) =>
      `${cn.id} · ${cn.date} · ${creditLabel(cn)} · −${currency(cn.total)}${
        cn.invoiceId ? ` → ${cn.invoiceId}` : ""
      }`,
  );
  return [
    `Hello ${client.contactName || client.name},`,
    "",
    "Parts Village account statement",
    ...rows,
    "",
    ...(credits.length
      ? ["Credits / returns / discounts:", ...credits, ""]
      : []),
    `0–30 days: ${currency(statement.current)}`,
    `31–60 days: ${currency(statement.days31To60)}`,
    `61+ days: ${currency(statement.days61Plus)}`,
    `Total due: ${currency(statement.total)}`,
    ...(statement.unappliedCredits > 0.005
      ? [
          `Unapplied credit: −${currency(statement.unappliedCredits)}`,
          `Net due: ${currency(statement.netDue)}`,
        ]
      : []),
    ...(promised ? [`Promised pay date: ${promised}`] : []),
    "",
    "Please arrange payment at your earliest convenience. Thank you.",
  ].join("\n");
}

export function overdueReminderText(
  client: PartyRecord,
  statement: ArStatement,
  opts?: { promisedPayDate?: string },
): string {
  const promised = (opts?.promisedPayDate ?? client.promisedPayDate)?.trim();
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
    ...(promised ? [`You promised to pay by ${promised}.`] : []),
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

export async function downloadStatementPdf(client: PartyRecord, statement: ArStatement) {
  await ensurePdfArabicFont();
  const pdf = new jsPDF();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("PARTS VILLAGE", 14, 18);
  pdf.setFontSize(13);
  pdf.text("Account statement", 14, 29);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdfDrawText(pdf, `Client: ${client.name}`, 14, 38, {
    maxWidthMm: 180,
    color: "#000000",
    align: "left",
  });
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44);

  const arabicHooks = {
    didParseCell: (data: { section: string; cell: { raw?: unknown; text: string[] } }) => {
      const raw = String(data.cell.raw ?? "");
      if (data.section === "body" && hasArabic(raw)) data.cell.text = [""];
    },
    didDrawCell: (data: {
      section: string;
      cell: {
        raw?: unknown;
        x: number;
        y: number;
        width: number;
        height: number;
        styles: { fontSize?: number };
      };
    }) => {
      const raw = String(data.cell.raw ?? "");
      if (data.section !== "body" || !hasArabic(raw)) return;
      const img = renderArabicPng(raw, {
        fontPt: data.cell.styles.fontSize ?? 10,
        maxWidthMm: Math.max(8, data.cell.width - 4),
        color: "#000000",
        align: "left",
      });
      if (!img.dataUrl) return;
      pdf.addImage(
        img.dataUrl,
        "PNG",
        data.cell.x + 2,
        data.cell.y + (data.cell.height - img.heightMm) / 2,
        img.widthMm,
        img.heightMm,
      );
    },
  };

  autoTable(pdf, {
    startY: 51,
    head: [["Invoice", "Date", "Age", "Total", "Paid", "Credits", "Due"]],
    body: statement.rows.map((row) => [
      row.invoice.id,
      row.invoice.date,
      `${row.ageDays}d`,
      currency(row.invoice.total),
      currency(row.paid),
      currency(row.credits),
      currency(row.remaining),
    ]),
    styles: { font: "helvetica", fontStyle: "normal" },
    headStyles: { font: "helvetica", fontStyle: "bold" },
    ...arabicHooks,
  });
  let finalY =
    (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;

  if (statement.creditNotes.length > 0) {
    autoTable(pdf, {
      startY: finalY + 8,
      head: [["Credit", "Date", "Type", "Invoice", "Amount"]],
      body: statement.creditNotes.map((cn) => [
        cn.id,
        cn.date,
        creditLabel(cn),
        cn.invoiceId ?? "—",
        `−${currency(cn.total)}`,
      ]),
      styles: { font: "helvetica", fontStyle: "normal" },
      headStyles: { font: "helvetica", fontStyle: "bold" },
      ...arabicHooks,
    });
    finalY =
      (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? finalY;
  }

  pdf.setFont("helvetica", "bold");
  let y = finalY + 12;
  if (statement.unappliedCredits > 0.005) {
    pdf.setFont("helvetica", "normal");
    pdf.text(`Invoice total: ${currency(statement.total)}`, 14, y);
    y += 6;
    pdf.text(`Unapplied credit: −${currency(statement.unappliedCredits)}`, 14, y);
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Net due: ${currency(statement.netDue)}`, 14, y);
  } else {
    pdf.text(`Total due: ${currency(statement.total)}`, 14, y);
  }
  pdf.save(`statement-${client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
