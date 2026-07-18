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
};

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
  return `${prefix}-${y}${m}${d}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

function lineTotal(line: CartLine) {
  return line.qty * (line.unitPrice || 0);
}

export function buildShareText(doc: ExportDoc): string {
  const date = doc.createdAt ?? new Date();
  const id = docId(doc.documentKind, date);
  const title = docLabels[doc.documentKind];
  const partyLabel = doc.partyKind === "client" ? "Client" : "Supplier";
  const rows = doc.lines
    .map(
      (l) =>
        `• ${l.partNumber} × ${l.qty}` +
        (l.insideDiameterMm || l.crossSectionMm
          ? ` (${l.insideDiameterMm ?? "?"}×${l.crossSectionMm ?? "?"} mm)`
          : "") +
        (l.unitPrice > 0 ? ` — ${currency(lineTotal(l))}` : ""),
    )
    .join("\n");
  const total = doc.lines.reduce((s, l) => s + lineTotal(l), 0);
  return [
    `Parts Village — ${title}`,
    `Ref: ${id}`,
    `${partyLabel}: ${doc.partyName}`,
    "",
    rows,
    "",
    total > 0 ? `Total: ${currency(total)}` : "Prices TBD",
  ].join("\n");
}

export function downloadExcel(doc: ExportDoc) {
  const date = doc.createdAt ?? new Date();
  const id = docId(doc.documentKind, date);
  const partyLabel = doc.partyKind === "client" ? "Client" : "Supplier";

  const meta = [
    ["Parts Village"],
    [docLabels[doc.documentKind]],
    ["Reference", id],
    ["Date", date.toISOString().slice(0, 10)],
    [partyLabel, doc.partyName],
    [],
  ];

  const header = ["Part #", "Name", "Box", "ID (mm)", "CS (mm)", "Qty", "Unit Price", "Line Total"];
  const body = doc.lines.map((l) => [
    l.partNumber,
    l.name,
    l.boxNumber ?? "",
    l.insideDiameterMm ?? "",
    l.crossSectionMm ?? "",
    l.qty,
    l.unitPrice || "",
    l.unitPrice > 0 ? lineTotal(l) : "",
  ]);
  const total = doc.lines.reduce((s, l) => s + lineTotal(l), 0);
  body.push(["", "", "", "", "", "", "TOTAL", total > 0 ? total : ""]);

  const sheet = XLSX.utils.aoa_to_sheet([...meta, header, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, docLabels[doc.documentKind]);
  XLSX.writeFile(book, `${id}.xlsx`);
  return id;
}

export function downloadPdf(doc: ExportDoc) {
  const date = doc.createdAt ?? new Date();
  const id = docId(doc.documentKind, date);
  const partyLabel = doc.partyKind === "client" ? "Client" : "Supplier";
  const pdf = new jsPDF();

  pdf.setFontSize(16);
  pdf.text("Parts Village", 14, 18);
  pdf.setFontSize(12);
  pdf.text(docLabels[doc.documentKind], 14, 26);
  pdf.setFontSize(10);
  pdf.text(`Reference: ${id}`, 14, 34);
  pdf.text(`Date: ${date.toISOString().slice(0, 10)}`, 14, 40);
  pdf.text(`${partyLabel}: ${doc.partyName}`, 14, 46);

  const total = doc.lines.reduce((s, l) => s + lineTotal(l), 0);

  autoTable(pdf, {
    startY: 52,
    head: [["Part #", "Name", "Box", "ID", "CS", "Qty", "Price", "Total"]],
    body: doc.lines.map((l) => [
      l.partNumber,
      l.name,
      l.boxNumber ?? "—",
      l.insideDiameterMm ?? "—",
      l.crossSectionMm ?? "—",
      String(l.qty),
      l.unitPrice > 0 ? currency(l.unitPrice) : "—",
      l.unitPrice > 0 ? currency(lineTotal(l)) : "—",
    ]),
    foot: [["", "", "", "", "", "", "TOTAL", total > 0 ? currency(total) : "TBD"]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

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
