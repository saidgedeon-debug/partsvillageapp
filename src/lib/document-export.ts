import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import type { CartLine, DocumentKind, PartyKind } from "@/components/app/cart-context";
import { currency } from "@/lib/mock-data";
import { PARTS_VILLAGE_LOGO_PNG_BASE64 } from "@/lib/parts-village-logo-base64";

export type ExportDoc = {
  /** When set (re-opening a saved doc), reuse this reference instead of generating a new one. */
  id?: string;
  documentKind: DocumentKind;
  partyKind: PartyKind;
  partyName: string;
  lines: CartLine[];
  createdAt?: Date;
  /** For supplier inquiries: include cost columns when true. */
  includeCost?: boolean;
};

export type ExportFormat = "pdf" | "excel";
export type DeliveryMethod = "whatsapp" | "wechat" | "email" | "offline";

const docLabels: Record<DocumentKind, string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  inquiry: "Supplier Inquiry",
};

/** Brand palette from Parts Village logo */
const NAVY: [number, number, number] = [18, 42, 86];
const ORANGE: [number, number, number] = [232, 122, 24];
const SLATE: [number, number, number] = [88, 98, 112];
const LIGHT: [number, number, number] = [246, 248, 251];
const WHITE: [number, number, number] = [255, 255, 255];

const LOGO_DATA_URL = `data:image/png;base64,${PARTS_VILLAGE_LOGO_PNG_BASE64}`;

function docId(kind: DocumentKind, date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const prefix = kind === "quotation" ? "Q" : kind === "invoice" ? "INV" : "SI";
  return `${prefix}-${y}${m}${d}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
}

/** Public helper for document ids (checkout persistence). */
export function generateDocId(kind: DocumentKind, date = new Date()) {
  return docId(kind, date);
}

/** Selling price for quotes/invoices; supplier cost for inquiries. */
export function lineUnitAmount(line: CartLine, kind: DocumentKind): number {
  if (kind === "inquiry") return line.unitCost || 0;
  return line.unitPrice || 0;
}

function lineTotal(line: CartLine, kind: DocumentKind) {
  return line.qty * lineUnitAmount(line, kind);
}

/** Display size on invoices: "26.5 x 3". */
export function lineSizeLabel(line: CartLine): string {
  const id = line.insideDiameterMm?.trim() ?? "";
  const cs = line.crossSectionMm?.trim() ?? "";
  if (id && cs) return `${id} x ${cs}`;
  return id || cs || "";
}

function showMoney(doc: ExportDoc) {
  if (doc.documentKind === "inquiry") return Boolean(doc.includeCost);
  return true;
}

function resolveDocId(doc: ExportDoc, date: Date) {
  return doc.id?.trim() || docId(doc.documentKind, date);
}

export function buildShareText(doc: ExportDoc): string {
  const date = doc.createdAt ?? new Date();
  const id = resolveDocId(doc, date);
  const title = docLabels[doc.documentKind];
  const partyLabel = doc.partyKind === "client" ? "Client" : "Supplier";
  const withMoney = showMoney(doc);
  const rows = doc.lines
    .map((l) => {
      const unit = lineUnitAmount(l, doc.documentKind);
      const size = lineSizeLabel(l);
      return (
        `• ${l.partNumber}` +
        (l.name ? ` — ${l.name}` : "") +
        (size ? ` · size ${size}` : "") +
        ` × ${l.qty}` +
        (withMoney && unit > 0 ? ` — ${currency(lineTotal(l, doc.documentKind))}` : "")
      );
    })
    .join("\n");
  const total = doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0);
  const footer =
    withMoney && total > 0
      ? `Total: ${currency(total)}`
      : doc.documentKind === "inquiry"
        ? withMoney
          ? "Costs TBD"
          : "Please quote availability and pricing"
        : "Prices TBD";

  return [
    `Parts Village — ${title}`,
    `Ref: ${id}`,
    `${partyLabel}: ${doc.partyName}`,
    "",
    rows,
    "",
    footer,
  ].join("\n");
}

export function downloadExcel(doc: ExportDoc) {
  const date = doc.createdAt ?? new Date();
  const id = resolveDocId(doc, date);
  const partyLabel = doc.partyKind === "client" ? "Client" : "Supplier";
  const withMoney = showMoney(doc);
  const moneyLabel = doc.documentKind === "inquiry" ? "Unit Cost" : "Unit Price";

  const meta = [
    ["Parts Village"],
    [docLabels[doc.documentKind]],
    ["Reference", id],
    ["Date", date.toISOString().slice(0, 10)],
    [partyLabel, doc.partyName],
    [],
  ];

  const header = withMoney
    ? ["Part #", "Description", "Size", "Qty", moneyLabel, "Line Total"]
    : ["Part #", "Description", "Size", "Qty"];

  const body = doc.lines.map((l) => {
    const base = [l.partNumber, l.name, lineSizeLabel(l), l.qty];
    if (!withMoney) return base;
    const unit = lineUnitAmount(l, doc.documentKind);
    return [...base, unit || "", unit > 0 ? lineTotal(l, doc.documentKind) : ""];
  });

  if (withMoney) {
    const total = doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0);
    body.push(["", "", "", "", "TOTAL", total > 0 ? total : ""]);
  }

  const sheet = XLSX.utils.aoa_to_sheet([...meta, header, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, docLabels[doc.documentKind].slice(0, 31));
  XLSX.writeFile(book, `${id}.xlsx`);
  return id;
}

function drawRoundedRect(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: [number, number, number],
) {
  pdf.setFillColor(...fill);
  pdf.roundedRect(x, y, w, h, r, r, "F");
}

/** Build the branded PDF document (no download / no open). */
export function buildPdf(doc: ExportDoc): { pdf: jsPDF; id: string } {
  const date = doc.createdAt ?? new Date();
  const id = resolveDocId(doc, date);
  const partyLabel = doc.partyKind === "client" ? "Bill to" : "Supplier";
  const withMoney = showMoney(doc);
  const moneyLabel = doc.documentKind === "inquiry" ? "Cost" : "Price";
  const title = docLabels[doc.documentKind].toUpperCase();
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;

  // Top accent bars
  pdf.setFillColor(...ORANGE);
  pdf.rect(0, 0, pageW, 3.2, "F");
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 3.2, pageW, 1.1, "F");

  // Soft header wash
  pdf.setFillColor(...LIGHT);
  pdf.rect(0, 4.3, pageW, 42, "F");

  // Transparent logo (no black background)
  const logoW = 36;
  const logoH = 37.5;
  try {
    pdf.addImage(LOGO_DATA_URL, "PNG", margin, 7.5, logoW, logoH, undefined, "FAST");
  } catch {
    // logo optional if image fails
  }

  // Document type badge (right)
  const badgeW = 48;
  const badgeH = 12;
  const badgeX = pageW - margin - badgeW;
  drawRoundedRect(pdf, badgeX, 12, badgeW, badgeH, 2.5, ORANGE);
  pdf.setTextColor(...WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(title, badgeX + badgeW / 2, 19.5, { align: "center" });

  // Tagline under badge
  pdf.setTextColor(...SLATE);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("HEAVY EQUIPMENT PARTS", badgeX + badgeW / 2, 30, { align: "center" });

  // Orange rule under header
  pdf.setDrawColor(...ORANGE);
  pdf.setLineWidth(0.7);
  pdf.line(margin, 46, pageW - margin, 46);

  // Meta cards
  const cardY = 50;
  const cardH = 28;
  const cardGap = 4;
  const cardW = (pageW - margin * 2 - cardGap) / 2;

  drawRoundedRect(pdf, margin, cardY, cardW, cardH, 2, LIGHT);
  pdf.setFillColor(...ORANGE);
  pdf.rect(margin, cardY, 1.6, cardH, "F");

  pdf.setTextColor(...ORANGE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(partyLabel.toUpperCase(), margin + 5, cardY + 7);
  pdf.setTextColor(...NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(doc.partyName || "—", margin + 5, cardY + 15);
  pdf.setTextColor(...SLATE);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Parts Village client document", margin + 5, cardY + 22);

  const rightX = margin + cardW + cardGap;
  drawRoundedRect(pdf, rightX, cardY, cardW, cardH, 2, LIGHT);
  pdf.setFillColor(...NAVY);
  pdf.rect(rightX, cardY, 1.6, cardH, "F");

  pdf.setTextColor(...ORANGE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("DOCUMENT", rightX + 5, cardY + 7);
  pdf.setTextColor(...NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(id, rightX + 5, cardY + 14);
  pdf.setTextColor(...SLATE);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`Date  ${date.toISOString().slice(0, 10)}`, rightX + 5, cardY + 21);

  const total = doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0);
  const tableStart = cardY + cardH + 8;

  if (withMoney) {
    autoTable(pdf, {
      startY: tableStart,
      margin: { left: margin, right: margin },
      head: [["Part #", "Description", "Size", "Qty", moneyLabel, "Total"]],
      body: doc.lines.map((l) => {
        const unit = lineUnitAmount(l, doc.documentKind);
        return [
          l.partNumber,
          l.name || "—",
          lineSizeLabel(l) || "—",
          String(l.qty),
          unit > 0 ? currency(unit) : "—",
          unit > 0 ? currency(lineTotal(l, doc.documentKind)) : "—",
        ];
      }),
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 },
        textColor: NAVY,
        lineColor: [220, 226, 234],
        lineWidth: 0.2,
        valign: "middle",
      },
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
      },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 28, fontStyle: "bold", textColor: ORANGE },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      },
      didDrawPage: () => {
        pdf.setFillColor(...ORANGE);
        pdf.rect(0, 0, pageW, 3.2, "F");
        pdf.setFillColor(...NAVY);
        pdf.rect(0, 3.2, pageW, 1.1, "F");
      },
    });
  } else {
    autoTable(pdf, {
      startY: tableStart,
      margin: { left: margin, right: margin },
      head: [["Part #", "Description", "Size", "Qty"]],
      body: doc.lines.map((l) => [
        l.partNumber,
        l.name || "—",
        lineSizeLabel(l) || "—",
        String(l.qty),
      ]),
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: NAVY,
        lineColor: [220, 226, 234],
        lineWidth: 0.2,
      },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        2: { fontStyle: "bold", textColor: ORANGE },
      },
    });
  }

  const finalY =
    ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      tableStart) + 8;

  // Total hero box
  if (withMoney) {
    const boxW = 72;
    const boxH = 22;
    const boxX = pageW - margin - boxW;
    drawRoundedRect(pdf, boxX, finalY, boxW, boxH, 2.5, NAVY);
    pdf.setFillColor(...ORANGE);
    pdf.rect(boxX, finalY, 2.2, boxH, "F");
    pdf.setTextColor(...ORANGE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("AMOUNT DUE", boxX + 8, finalY + 8);
    pdf.setTextColor(...WHITE);
    pdf.setFontSize(16);
    pdf.text(total > 0 ? currency(total) : "TBD", boxX + 8, finalY + 17);
  }

  // Footer
  const footerY = pageH - 16;
  pdf.setDrawColor(...ORANGE);
  pdf.setLineWidth(0.5);
  pdf.line(margin, footerY, pageW - margin, footerY);
  pdf.setTextColor(...SLATE);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text("PARTS VILLAGE  ·  Heavy Equipment Parts", margin, footerY + 6);
  pdf.setTextColor(...ORANGE);
  pdf.setFont("helvetica", "bold");
  pdf.text(id, pageW - margin, footerY + 6, { align: "right" });

  return { pdf, id };
}

/** Build PDF and return a blob URL for in-app preview (does not download). */
export function viewPdf(doc: ExportDoc): { id: string; blobUrl: string } {
  const { pdf, id } = buildPdf(doc);
  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  return { id, blobUrl };
}

/** Explicit download only — call when the user asks to download. */
export function downloadPdf(doc: ExportDoc): string {
  const { pdf, id } = buildPdf(doc);
  pdf.save(`${id}.pdf`);
  return id;
}

function toExportDoc(doc: {
  id: string;
  kind: DocumentKind;
  partyKind: PartyKind;
  partyName: string;
  lines: CartLine[];
  createdAt: string;
  includeCost?: boolean;
}): ExportDoc {
  return {
    id: doc.id,
    documentKind: doc.kind,
    partyKind: doc.partyKind,
    partyName: doc.partyName,
    lines: doc.lines,
    createdAt: new Date(doc.createdAt),
    includeCost: doc.includeCost,
  };
}

/** Preview a saved document (no download). */
export function openSavedDocument(doc: {
  id: string;
  kind: DocumentKind;
  partyKind: PartyKind;
  partyName: string;
  lines: CartLine[];
  createdAt: string;
  includeCost?: boolean;
}): { id: string; blobUrl: string } {
  return viewPdf(toExportDoc(doc));
}

/** Download a saved document PDF. */
export function downloadSavedDocument(doc: {
  id: string;
  kind: DocumentKind;
  partyKind: PartyKind;
  partyName: string;
  lines: CartLine[];
  createdAt: string;
  includeCost?: boolean;
}): string {
  return downloadPdf(toExportDoc(doc));
}

export function openWhatsApp(doc: ExportDoc) {
  const text = buildShareText(doc);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function openWeChatShare(doc: ExportDoc) {
  const text = buildShareText(doc);
  void navigator.clipboard.writeText(text);
  return text;
}

export function openEmailShare(doc: ExportDoc) {
  const date = doc.createdAt ?? new Date();
  const id = resolveDocId(doc, date);
  const subject = `Parts Village — ${docLabels[doc.documentKind]} ${id}`;
  const body = buildShareText(doc);
  window.open(
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    "_blank",
  );
}

export function exportAndDeliver(
  doc: ExportDoc,
  format: ExportFormat,
  delivery: DeliveryMethod,
): string {
  const id = format === "pdf" ? downloadPdf(doc) : downloadExcel(doc);
  if (delivery === "whatsapp") openWhatsApp(doc);
  if (delivery === "wechat") openWeChatShare(doc);
  if (delivery === "email") openEmailShare(doc);
  return id;
}
