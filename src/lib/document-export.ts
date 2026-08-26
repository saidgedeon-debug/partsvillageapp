import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import type { CartLine, DocumentKind, PartyKind } from "@/components/app/cart-context";
import { currency } from "@/lib/mock-data";
import { documentGrandTotal, documentTaxAmount, documentDiscountAmount, normalizeDocumentDiscount, roundMoney } from "@/lib/document-money";
import type { DocumentDiscountType } from "@/lib/document-money";
import { PARTS_VILLAGE_LOGO_PNG_BASE64 } from "@/lib/parts-village-logo-base64";
import {
  ensurePdfArabicFont,
  hasArabic,
  pdfDrawText,
  renderArabicPng,
} from "@/lib/pdf-fonts";

const docLabels: Record<DocumentKind, string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  inquiry: "Supplier Inquiry",
  receipt: "Receipt",
  credit_note: "Credit Note",
};

export type ExportFormat = "pdf" | "excel";
export type DeliveryMethod = "whatsapp" | "wechat" | "email" | "offline";

export type PaymentMethod = "OMT" | "Whish" | "Cash";

export type ExportDoc = {
  /** When set (re-opening a saved doc), reuse this reference instead of generating a new one. */
  id?: string;
  documentKind: DocumentKind;
  partyKind: PartyKind;
  partyName: string;
  partyPhone?: string;
  lines: CartLine[];
  createdAt?: Date;
  /** For supplier inquiries: include cost columns when true. */
  includeCost?: boolean;
  /** Document-level discount. */
  discountType?: DocumentDiscountType;
  discountValue?: number;
  /** Receipt fields */
  invoiceId?: string;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  paymentMobile?: string;
  invoiceTotal?: number;
  amountPaidAfter?: number;
  internalNote?: string;
};

function exportDiscount(doc: ExportDoc) {
  return normalizeDocumentDiscount(
    doc.discountType === "amount" ? "amount" : "percent",
    typeof doc.discountValue === "number" ? doc.discountValue : 0,
  );
}

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
  const prefix =
    kind === "quotation"
      ? "Q"
      : kind === "invoice"
        ? "INV"
        : kind === "receipt"
          ? "RCP"
          : kind === "credit_note"
            ? "CN"
            : "SI";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${y}${m}${d}-${hh}${mm}${ss}${ms}-${rand}`;
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

export function lineTotal(line: CartLine, kind: DocumentKind) {
  return roundMoney(line.qty * lineUnitAmount(line, kind));
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

function receiptMetaLines(doc: ExportDoc): string[] {
  const lines: string[] = [];
  if (doc.invoiceId) lines.push(`Invoice  ${doc.invoiceId}`);
  if (doc.paymentMethod) lines.push(`Method  ${doc.paymentMethod}`);
  if (doc.paymentDate) lines.push(`Paid on  ${doc.paymentDate}`);
  if (doc.paymentMethod && doc.paymentMethod !== "Cash" && doc.paymentMobile) {
    lines.push(`Mobile  ${doc.paymentMobile}`);
  }
  return lines;
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
  const subtotal = roundMoney(doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0));
  const discount = exportDiscount(doc);
  const discountAmt = documentDiscountAmount(subtotal, discount);
  const tax = documentTaxAmount(subtotal - discountAmt);
  const total = documentGrandTotal(subtotal, discount);
  const footer =
    withMoney && total > 0
      ? [
          discountAmt > 0 ? `Subtotal: ${currency(subtotal)}` : null,
          discountAmt > 0
            ? `Discount${discount?.type === "percent" ? ` (${discount.value}%)` : ""}: −${currency(discountAmt)}`
            : null,
          tax > 0 ? `Tax: ${currency(tax)}` : null,
          `Total: ${currency(total)}`,
        ]
          .filter(Boolean)
          .join("\n")
      : doc.documentKind === "inquiry"
        ? withMoney
          ? "Costs TBD"
          : "Please quote availability and pricing"
        : "Prices TBD";

  return [
    `Hello ${doc.partyName},`,
    "",
    `Parts Village — ${title}`,
    `Ref: ${id}`,
    `${partyLabel}: ${doc.partyName}`,
    "",
    rows,
    "",
    footer,
    "",
    "PDF document attached.",
  ].join("\n");
}

function forceDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
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
    const subtotal = roundMoney(doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0));
    const discount = exportDiscount(doc);
    const discountAmt = documentDiscountAmount(subtotal, discount);
    const total = documentGrandTotal(subtotal, discount);
    if (discountAmt > 0) {
      body.push(["", "", "", "", "SUBTOTAL", subtotal]);
      body.push([
        "",
        "",
        "",
        "",
        discount?.type === "percent" ? `DISCOUNT (${discount.value}%)` : "DISCOUNT",
        -discountAmt,
      ]);
    }
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
export async function buildPdf(doc: ExportDoc): Promise<{ pdf: jsPDF; id: string }> {
  await ensurePdfArabicFont();
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
  pdfDrawText(pdf, doc.partyName || "—", margin + 5, cardY + 15, {
    maxWidthMm: cardW - 12,
    color: "#0B1F33",
    align: "left",
  });
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

  // Receipt payment details under meta cards
  let tableStart = cardY + cardH + 8;
  if (doc.documentKind === "receipt") {
    const meta = receiptMetaLines(doc);
    let metaY = cardY + cardH + 6;
    pdf.setTextColor(...NAVY);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("PAYMENT DETAILS", margin, metaY);
    metaY += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE);
    for (const line of meta) {
      pdf.text(line, margin, metaY);
      metaY += 5;
    }
    if (doc.internalNote?.trim()) {
      pdf.text(`Note  ${doc.internalNote.trim()}`, margin, metaY);
      metaY += 5;
    }
    tableStart = metaY + 4;
  }

  const subtotal = roundMoney(doc.lines.reduce((s, l) => s + lineTotal(l, doc.documentKind), 0));
  const discount = exportDiscount(doc);
  const discountAmt = documentDiscountAmount(subtotal, discount);
  const total = documentGrandTotal(subtotal, discount);

  const arabicCellHooks = {
    didParseCell: (data: {
      section: string;
      cell: { raw?: unknown; text: string[] };
    }) => {
      const raw = String(data.cell.raw ?? "");
      if (data.section === "body" && hasArabic(raw)) {
        data.cell.text = [""];
      }
    },
    didDrawCell: (data: {
      section: string;
      cell: {
        raw?: unknown;
        x: number;
        y: number;
        width: number;
        height: number;
        styles: { fontSize?: number; textColor?: unknown };
      };
    }) => {
      const raw = String(data.cell.raw ?? "");
      if (data.section !== "body" || !hasArabic(raw)) return;
      const pad = 2;
      const fontPt = data.cell.styles.fontSize ?? 8.5;
      const img = renderArabicPng(raw, {
        fontPt,
        maxWidthMm: Math.max(8, data.cell.width - pad * 2),
        color: "#0B1F33",
        align: "right",
      });
      if (!img.dataUrl) return;
      const x = data.cell.x + data.cell.width - pad - img.widthMm;
      const y = data.cell.y + (data.cell.height - img.heightMm) / 2;
      pdf.addImage(img.dataUrl, "PNG", x, y, img.widthMm, img.heightMm);
    },
  };

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
        font: "helvetica",
        fontStyle: "normal",
        fontSize: 8.5,
        cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 },
        textColor: NAVY,
        lineColor: [220, 226, 234],
        lineWidth: 0.2,
        valign: "middle",
      },
      headStyles: {
        font: "helvetica",
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
      },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold" },
        1: { cellWidth: "auto", halign: "right" },
        2: { cellWidth: 28, fontStyle: "bold", textColor: ORANGE },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      },
      ...arabicCellHooks,
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
        font: "helvetica",
        fontStyle: "normal",
        fontSize: 8.5,
        cellPadding: 3,
        textColor: NAVY,
        lineColor: [220, 226, 234],
        lineWidth: 0.2,
      },
      headStyles: {
        font: "helvetica",
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        1: { halign: "right" },
        2: { fontStyle: "bold", textColor: ORANGE },
      },
      ...arabicCellHooks,
    });
  }

  const finalY =
    ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      tableStart) + 8;

  // Total hero box
  if (withMoney) {
    const boxW = 72;
    const hasDiscount = discountAmt > 0;
    const boxH =
      doc.documentKind === "receipt" ? 28 : hasDiscount ? 36 : 22;
    const boxX = pageW - margin - boxW;
    drawRoundedRect(pdf, boxX, finalY, boxW, boxH, 2.5, NAVY);
    pdf.setFillColor(...ORANGE);
    pdf.rect(boxX, finalY, 2.2, boxH, "F");
    let textY = finalY + 7;
    if (hasDiscount) {
      pdf.setTextColor(...ORANGE);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(`Subtotal  ${currency(subtotal)}`, boxX + 8, textY);
      textY += 5;
      pdf.text(
        `Discount${discount?.type === "percent" ? ` ${discount.value}%` : ""}  −${currency(discountAmt)}`,
        boxX + 8,
        textY,
      );
      textY += 6;
    }
    pdf.setTextColor(...ORANGE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(
      doc.documentKind === "receipt"
        ? "AMOUNT PAID"
        : doc.documentKind === "credit_note"
          ? "CREDIT TOTAL"
          : "AMOUNT DUE",
      boxX + 8,
      textY,
    );
    pdf.setTextColor(...WHITE);
    pdf.setFontSize(16);
    pdf.text(total > 0 ? currency(total) : "TBD", boxX + 8, textY + 9);
    if (
      doc.documentKind === "receipt" &&
      typeof doc.invoiceTotal === "number" &&
      typeof doc.amountPaidAfter === "number"
    ) {
      const rem = Math.max(0, Math.round((doc.invoiceTotal - doc.amountPaidAfter) * 100) / 100);
      pdf.setFontSize(7.5);
      pdf.setTextColor(...ORANGE);
      pdf.text(
        rem <= 0.005 ? "Invoice paid in full" : `Remaining  ${currency(rem)}`,
        boxX + 8,
        textY + 16,
      );
    }
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

/** Build a PDF File for download / native share (never a website URL). */
export async function buildPdfFile(doc: ExportDoc): Promise<{ id: string; file: File }> {
  const { pdf, id } = await buildPdf(doc);
  const blob = pdf.output("blob");
  const file = new File([blob], `${id}.pdf`, { type: "application/pdf" });
  return { id, file };
}

export function canSharePdfFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

/**
 * Share the PDF file itself via the OS share sheet.
 * Deliberately omits `url` so recipients never get a website link.
 */
export async function sharePdfFile(
  doc: ExportDoc,
): Promise<{ id: string; shared: boolean; cancelled?: boolean }> {
  const { id, file } = await buildPdfFile(doc);
  const title = `Parts Village — ${docLabels[doc.documentKind]} ${id}`;
  const text = buildShareText(doc);

  if (canSharePdfFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title,
        text,
      });
      return { id, shared: true };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { id, shared: false, cancelled: true };
      }
    }
  }

  forceDownloadBlob(file, `${id}.pdf`);
  return { id, shared: false };
}

/** Build PDF and return a blob URL for in-app preview (does not download). */
export async function viewPdf(doc: ExportDoc): Promise<{ id: string; blobUrl: string }> {
  const { id, file } = await buildPdfFile(doc);
  const blobUrl = URL.createObjectURL(file);
  return { id, blobUrl };
}

/** Explicit download only — call when the user asks to download. */
export async function downloadPdf(doc: ExportDoc): Promise<string> {
  const { id, file } = await buildPdfFile(doc);
  forceDownloadBlob(file, `${id}.pdf`);
  return id;
}

type SavedDocInput = {
  id: string;
  kind: DocumentKind;
  partyKind: PartyKind;
  partyName: string;
  lines: CartLine[];
  createdAt: string;
  includeCost?: boolean;
  discountType?: DocumentDiscountType;
  discountValue?: number;
  invoiceId?: string;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  paymentMobile?: string;
  invoiceTotal?: number;
  amountPaidAfter?: number;
  internalNote?: string;
};

function toExportDoc(doc: SavedDocInput): ExportDoc {
  return {
    id: doc.id,
    documentKind: doc.kind,
    partyKind: doc.partyKind,
    partyName: doc.partyName,
    lines: doc.lines,
    createdAt: new Date(doc.createdAt),
    includeCost: doc.includeCost,
    discountType: doc.discountType,
    discountValue: doc.discountValue,
    invoiceId: doc.invoiceId,
    paymentMethod: doc.paymentMethod,
    paymentDate: doc.paymentDate,
    paymentMobile: doc.paymentMobile,
    invoiceTotal: doc.invoiceTotal,
    amountPaidAfter: doc.amountPaidAfter,
    internalNote: doc.internalNote,
  };
}

/** Preview a saved document (no download). */
export async function openSavedDocument(
  doc: SavedDocInput,
): Promise<{ id: string; blobUrl: string }> {
  return viewPdf(toExportDoc(doc));
}

/** Download a saved document PDF. */
export async function downloadSavedDocument(doc: SavedDocInput): Promise<string> {
  return downloadPdf(toExportDoc(doc));
}

/** Share a saved document as a PDF file (no website link). */
export async function shareSavedDocument(
  doc: SavedDocInput,
): Promise<{ id: string; shared: boolean; cancelled?: boolean }> {
  return sharePdfFile(toExportDoc(doc));
}

export function openWhatsApp(doc: ExportDoc) {
  const text = buildShareText(doc);
  const phone = (doc.partyPhone ?? "").replace(/\D/g, "");
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
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

export type ExportDeliveryResult = {
  id: string;
  /** True when the OS share sheet sent the PDF file (no website URL). */
  sharedFile: boolean;
  cancelled?: boolean;
};

/**
 * Export document and deliver.
 * For PDF + WhatsApp/WeChat/Email, prefers sharing the PDF file itself
 * (never a website link). Falls back to download + text channel.
 */
export async function exportAndDeliver(
  doc: ExportDoc,
  format: ExportFormat,
  delivery: DeliveryMethod,
): Promise<ExportDeliveryResult> {
  if (format === "pdf" && delivery !== "offline") {
    const result = await sharePdfFile(doc);
    if (result.cancelled) {
      return { id: result.id, sharedFile: false, cancelled: true };
    }
    if (result.shared) {
      return { id: result.id, sharedFile: true };
    }
    // Desktop / no file-share support: PDF downloaded; open text channel only (no URL).
    if (delivery === "whatsapp") openWhatsApp(doc);
    if (delivery === "wechat") openWeChatShare(doc);
    if (delivery === "email") openEmailShare(doc);
    return { id: result.id, sharedFile: false };
  }

  const id = format === "pdf" ? await downloadPdf(doc) : downloadExcel(doc);
  if (delivery === "whatsapp") openWhatsApp(doc);
  if (delivery === "wechat") openWeChatShare(doc);
  if (delivery === "email") openEmailShare(doc);
  return { id, sharedFile: false };
}
