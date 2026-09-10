import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  type ClientPartLine,
  type ReportParty,
} from "./client-report-lines";
import {
  ensurePdfArabicFont,
  hasArabic,
  pdfDrawText,
  renderArabicPng,
} from "./pdf-fonts";

export {
  buildClientPartReports,
  isReceivedPartStatus,
  isWaitingPartStatus,
  lineFulfillment,
  type ClientPartLine,
} from "./client-report-lines";

function fileSlug(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "client";
}

function arabicHooks(pdf: jsPDF) {
  return {
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
}

async function startClientPdf(client: ReportParty, title: string) {
  await ensurePdfArabicFont();
  const pdf = new jsPDF();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("PARTS VILLAGE", 14, 18);
  pdf.setFontSize(13);
  pdf.text(title, 14, 29);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdfDrawText(pdf, `Client: ${client.name}`, 14, 38, {
    maxWidthMm: 180,
    color: "#000000",
    align: "left",
  });
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44);
  return pdf;
}

export async function downloadPartsListPdf(
  client: ReportParty,
  title: string,
  filenamePrefix: string,
  rows: ClientPartLine[],
) {
  const pdf = await startClientPdf(client, title);
  autoTable(pdf, {
    startY: 51,
    head: [["Date", "Source", "Part #", "Description", "Qty", "Status"]],
    body:
      rows.length > 0
        ? rows.map((row) => [
            row.date,
            row.source,
            row.partNumber,
            row.name,
            String(row.qty),
            row.status,
          ])
        : [["—", "—", "—", "None", "—", "—"]],
    styles: { font: "helvetica", fontStyle: "normal", fontSize: 9 },
    headStyles: { font: "helvetica", fontStyle: "bold" },
    ...arabicHooks(pdf),
  });
  const finalY =
    (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  const qty = rows.reduce((sum, row) => sum + row.qty, 0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(
    `${rows.length} line${rows.length === 1 ? "" : "s"} · ${qty} unit${qty === 1 ? "" : "s"}`,
    14,
    finalY + 12,
  );
  pdf.save(`${filenamePrefix}-${fileSlug(client.name)}.pdf`);
}

export async function downloadPartsReceivedPdf(client: ReportParty, rows: ClientPartLine[]) {
  return downloadPartsListPdf(client, "Parts received", "parts-received", rows);
}

export async function downloadPartsWaitingPdf(client: ReportParty, rows: ClientPartLine[]) {
  return downloadPartsListPdf(client, "Parts still waiting", "parts-waiting", rows);
}
