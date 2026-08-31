import { jsPDF } from "jspdf";

import type { Part } from "@/lib/mock-data";
import { currency, locationOf, oemNumbersOf } from "@/lib/mock-data";
import { primaryPartImage } from "@/lib/part-image";

/** Compact shelf labels (57×32mm-ish) — part #, OEM, location, price. */
export async function printPartLabels(parts: Part[]): Promise<void> {
  if (parts.length === 0) return;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [57, 32],
  });

  for (let i = 0; i < parts.length; i++) {
    if (i > 0) pdf.addPage([57, 32], "landscape");
    const part = parts[i]!;
    const oem = oemNumbersOf(part)[0] ?? "";
    const loc = locationOf(part) || (part.boxNumber != null ? `Box ${part.boxNumber}` : "");

    pdf.setFillColor(18, 42, 86);
    pdf.rect(0, 0, 57, 6, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("PARTS VILLAGE", 2, 4.2);

    pdf.setTextColor(18, 42, 86);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(part.partNumber.slice(0, 18), 2, 12);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(88, 98, 112);
    if (oem) pdf.text(`OEM ${oem.slice(0, 22)}`, 2, 16.5);
    const name = (part.name || "").slice(0, 28);
    if (name) pdf.text(name, 2, 20.5);
    if (loc) pdf.text(String(loc).slice(0, 24), 2, 24.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(232, 122, 24);
    pdf.setFontSize(9);
    pdf.text(part.price > 0 ? currency(part.price) : "TBD", 2, 29);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5);
    pdf.setTextColor(18, 42, 86);
    pdf.text(part.partNumber, 38, 29, { align: "right" });

    const img = primaryPartImage(part);
    if (img?.startsWith("data:image")) {
      try {
        pdf.addImage(img, "JPEG", 40, 8, 14, 14);
      } catch {
        // ignore bad images
      }
    }
  }

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
