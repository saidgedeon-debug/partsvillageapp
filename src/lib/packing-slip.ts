import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { SavedDocument } from "@/components/app/documents-context";
import { effectiveFulfillment, fulfillmentIsMixed } from "@/lib/fulfillment";

/** Warehouse packing / pick slip — no prices, sorted by box when possible. */
export function downloadPackingSlip(doc: SavedDocument): void {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;

  pdf.setFillColor(18, 42, 86);
  pdf.rect(0, 0, 210, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("PARTS VILLAGE — PACKING SLIP", margin, 12);

  pdf.setTextColor(18, 42, 86);
  pdf.setFontSize(11);
  pdf.text(`${doc.kind.toUpperCase()} ${doc.id}`, margin, 28);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(88, 98, 112);
  pdf.text(`Date: ${doc.date}`, margin, 34);
  pdf.text(`Customer: ${doc.partyName || "—"}`, margin, 40);
  const overall = effectiveFulfillment(doc);
  const mixed = fulfillmentIsMixed(doc.lines ?? []);
  if (overall) {
    pdf.text(`Status: ${mixed ? `Mixed (${overall})` : overall}`, margin, 46);
  }
  pdf.text(`Printed ${new Date().toLocaleString()}`, 120, 34);

  const lines = [...(doc.lines ?? [])].sort((a, b) => {
    const ba = a.boxNumber ?? 99999;
    const bb = b.boxNumber ?? 99999;
    if (ba !== bb) return ba - bb;
    return a.partNumber.localeCompare(b.partNumber);
  });

  autoTable(pdf, {
    startY: overall ? 52 : 48,
    head: [["Part #", "Description", "Box", "Size", "Qty", "Status"]],
    body: lines.map((l) => [
      l.partNumber,
      l.name || "—",
      l.boxNumber != null ? String(l.boxNumber) : "—",
      l.insideDiameterMm || l.crossSectionMm
        ? `${l.insideDiameterMm ?? "—"} × ${l.crossSectionMm ?? "—"}`
        : "—",
      String(l.qty),
      l.fulfillmentStatus ?? overall ?? "—",
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [18, 42, 86], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      2: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 12, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  });

  const finalY =
    (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  pdf.setFontSize(9);
  pdf.setTextColor(88, 98, 112);
  pdf.text("Picked by: ______________    Checked by: ______________", margin, finalY + 14);
  pdf.text("Customer sign: ______________    Date: ______________", margin, finalY + 22);

  pdf.save(`packing-slip-${doc.id}.pdf`);
}
