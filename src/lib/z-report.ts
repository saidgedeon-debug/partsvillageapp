import { jsPDF } from "jspdf";

import { currency } from "@/lib/mock-data";

export type ZReportInput = {
  date: string;
  expectedCash: number;
  expectedOmt: number;
  expectedWhish: number;
  countedCash: number;
  countedOmt: number;
  countedWhish: number;
  note?: string;
  receiptCount?: number;
};

/** Printable end-of-day Z-report for the cash drawer. */
export function downloadZReportPdf(input: ZReportInput): void {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16;
  let y = 20;

  pdf.setFillColor(18, 42, 86);
  pdf.rect(0, 0, 210, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("PARTS VILLAGE — Z-REPORT", margin, 12);

  pdf.setTextColor(18, 42, 86);
  pdf.setFontSize(11);
  y = 28;
  pdf.text(`Business day: ${input.date}`, margin, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(88, 98, 112);
  pdf.text(`Printed ${new Date().toLocaleString()}`, margin, y);
  if (input.receiptCount != null) {
    pdf.text(`${input.receiptCount} receipt${input.receiptCount === 1 ? "" : "s"}`, 120, y);
  }

  const rows: Array<[string, number, number, number]> = [
    ["Cash", input.expectedCash, input.countedCash, input.countedCash - input.expectedCash],
    ["OMT", input.expectedOmt, input.countedOmt, input.countedOmt - input.expectedOmt],
    ["Whish", input.expectedWhish, input.countedWhish, input.countedWhish - input.expectedWhish],
  ];

  y += 12;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(18, 42, 86);
  pdf.text("Method", margin, y);
  pdf.text("Expected", 70, y);
  pdf.text("Counted", 110, y);
  pdf.text("Variance", 150, y);
  y += 2;
  pdf.setDrawColor(220, 224, 230);
  pdf.line(margin, y, 194, y);
  y += 7;

  pdf.setFont("helvetica", "normal");
  for (const [label, exp, counted, variance] of rows) {
    pdf.setTextColor(18, 42, 86);
    pdf.text(label, margin, y);
    pdf.text(currency(exp), 70, y);
    pdf.text(currency(counted), 110, y);
    if (Math.abs(variance) > 0.005) pdf.setTextColor(180, 40, 40);
    else pdf.setTextColor(40, 140, 80);
    pdf.text(currency(variance), 150, y);
    y += 8;
  }

  const expTotal = input.expectedCash + input.expectedOmt + input.expectedWhish;
  const countedTotal = input.countedCash + input.countedOmt + input.countedWhish;
  const varTotal = countedTotal - expTotal;
  y += 4;
  pdf.setDrawColor(220, 224, 230);
  pdf.line(margin, y, 194, y);
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(18, 42, 86);
  pdf.text("TOTAL", margin, y);
  pdf.text(currency(expTotal), 70, y);
  pdf.text(currency(countedTotal), 110, y);
  if (Math.abs(varTotal) > 0.005) pdf.setTextColor(180, 40, 40);
  else pdf.setTextColor(40, 140, 80);
  pdf.text(currency(varTotal), 150, y);

  if (input.note?.trim()) {
    y += 14;
    pdf.setTextColor(18, 42, 86);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Note", margin, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(88, 98, 112);
    const lines = pdf.splitTextToSize(input.note.trim(), 178);
    pdf.text(lines, margin, y);
    y += lines.length * 5;
  }

  y += 20;
  pdf.setTextColor(88, 98, 112);
  pdf.setFontSize(9);
  pdf.text("Cashier signature: ________________________", margin, y);
  y += 10;
  pdf.text("Manager signature: _______________________", margin, y);

  pdf.save(`z-report-${input.date}.pdf`);
}
