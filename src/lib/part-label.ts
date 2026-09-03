import { jsPDF } from "jspdf";

import type { Part } from "@/lib/mock-data";
import { currency, locationOf, oemNumbersOf } from "@/lib/mock-data";
import { primaryPartImage } from "@/lib/part-image";

/** Minimal Code 39 patterns (digits + uppercase + dash). */
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
};

function drawCode39(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  heightMm: number,
  moduleMm: number,
) {
  const payload = `*${text.toUpperCase().replace(/[^A-Z0-9\-.\s]/g, "").slice(0, 14)}*`;
  let cursor = x;
  for (const ch of payload) {
    const pattern = CODE39[ch] ?? CODE39["-"];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i++) {
      const wide = pattern[i] === "w";
      const w = moduleMm * (wide ? 2.4 : 1);
      if (i % 2 === 0) {
        pdf.setFillColor(18, 42, 86);
        pdf.rect(cursor, y, w, heightMm, "F");
      }
      cursor += w;
    }
    cursor += moduleMm; // inter-char gap
  }
}

/** Compact shelf labels (57×32mm) with Code 39 barcode — AirPrint / Bluetooth ready. */
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
    pdf.setFontSize(10);
    pdf.text(part.partNumber.slice(0, 16), 2, 11);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(88, 98, 112);
    if (oem) pdf.text(`OEM ${oem.slice(0, 20)}`, 2, 14.5);
    if (loc) pdf.text(String(loc).slice(0, 22), 2, 17.5);

    drawCode39(pdf, part.partNumber, 2, 19, 6.5, 0.28);

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(232, 122, 24);
    pdf.setFontSize(9);
    pdf.text(part.price > 0 ? currency(part.price) : "TBD", 2, 29.5);

    const img = primaryPartImage(part);
    if (img?.startsWith("data:image")) {
      try {
        pdf.addImage(img, "JPEG", 42, 8, 12, 12);
      } catch {
        // ignore
      }
    }
  }

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
