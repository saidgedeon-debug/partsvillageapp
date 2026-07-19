import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import type { CartLine, DocumentKind, PartyKind } from "@/components/app/cart-context";
import { currency } from "@/lib/mock-data";

export type ExportDoc = {
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

function showMoney(doc: ExportDoc) {
  if (doc.documentKind === "inquiry") return Boolean(doc.includeCost);
  return true;
}

export function buildShareText(doc: ExportDoc): string {
  const date = doc.createdAt ?? new Date();
  const id = docId(doc.documentKind, date);
  const title = docLabels[doc.documentKind];
  const partyLabel = doc.partyKind === "client" ? "Client" : "Supplier";
  const withMoney = showMoney(doc);
  const rows = doc.lines
    .map((l) => {
      const unit = lineUnitAmount(l, doc.documentKind);
      return (
        `• ${l.partNumber} × ${l.qty}` +
        (l.insideDiameterMm || l.crossSectionMm
          ? ` (${l.insideDiameterMm ?? "?"}×${l.crossSectionMm ?? "?"} mm)`
          : "") +
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
  const id = docId(doc.documentKind, date);
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
    ? ["Part #", "Name", "Box", "ID (mm)", "CS (mm)", "Qty", moneyLabel, "Line Total"]
    : ["Part #", "Name", "Box", "ID (mm)", "CS (mm)", "Qty"];

  const body = doc.lines.map((l) => {
    const base = [
      l.partNumber,
      l.name,
      l.boxNumber ?? "",
      l.insideDiameterMm ?? "",
      l.crossSectionMm ?? "",
      l.qty,
    ];
    if (!withMoney) return base;
    const unit = lineUnitAmount(l, doc.documentKind);
    return [...base, unit || "", unit > 0 ? lineTotal(l, doc.documentKind) : ""];
  });

  if (withMoney) {
    const total = doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0);
    body.push(["", "", "", "", "", "", "TOTAL", total > 0 ? total : ""]);
  }

  const sheet = XLSX.utils.aoa_to_sheet([...meta, header, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, docLabels[doc.documentKind].slice(0, 31));
  XLSX.writeFile(book, `${id}.xlsx`);
  return id;
}

export function downloadPdf(doc: ExportDoc) {
  const date = doc.createdAt ?? new Date();
  const id = docId(doc.documentKind, date);
  const partyLabel = doc.partyKind === "client" ? "Client" : "Supplier";
  const withMoney = showMoney(doc);
  const moneyLabel = doc.documentKind === "inquiry" ? "Cost" : "Price";
  const pdf = new jsPDF();

  pdf.setFontSize(16);
  pdf.text("Parts Village", 14, 18);
  pdf.setFontSize(12);
  pdf.text(docLabels[doc.documentKind], 14, 26);
  pdf.setFontSize(10);
  pdf.text(`Reference: ${id}`, 14, 34);
  pdf.text(`Date: ${date.toISOString().slice(0, 10)}`, 14, 40);
  pdf.text(`${partyLabel}: ${doc.partyName}`, 14, 46);

  const total = doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0);

  if (withMoney) {
    autoTable(pdf, {
      startY: 52,
      head: [["Part #", "Name", "Box", "ID", "CS", "Qty", moneyLabel, "Total"]],
      body: doc.lines.map((l) => {
        const unit = lineUnitAmount(l, doc.documentKind);
        return [
          l.partNumber,
          l.name,
          l.boxNumber ?? "—",
          l.insideDiameterMm ?? "—",
          l.crossSectionMm ?? "—",
          String(l.qty),
          unit > 0 ? currency(unit) : "—",
          unit > 0 ? currency(lineTotal(l, doc.documentKind)) : "—",
        ];
      }),
      foot: [["", "", "", "", "", "", "TOTAL", total > 0 ? currency(total) : "TBD"]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
  } else {
    autoTable(pdf, {
      startY: 52,
      head: [["Part #", "Name", "Box", "ID", "CS", "Qty"]],
      body: doc.lines.map((l) => [
        l.partNumber,
        l.name,
        l.boxNumber ?? "—",
        l.insideDiameterMm ?? "—",
        l.crossSectionMm ?? "—",
        String(l.qty),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  pdf.save(`${id}.pdf`);
  return id;
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
  const id = docId(doc.documentKind, date);
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
