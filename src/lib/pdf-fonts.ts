import { rtlText } from "bidi-shaper/jspdf";
import type { jsPDF } from "jspdf";

import {
  PDF_ARABIC_FONT_BOLD_BASE64,
  PDF_ARABIC_FONT_NAME,
  PDF_ARABIC_FONT_REGULAR_BASE64,
} from "@/lib/pdf-arabic-font-base64";

export const PDF_FONT = PDF_ARABIC_FONT_NAME;

/**
 * Register Amiri on a jsPDF instance.
 * Do NOT also install a global jsPDF text shaper — autoTable calls doc.text(),
 * and shaping twice (rtlText + plugin) garbles Arabic.
 */
export function preparePdfFonts(pdf: jsPDF) {
  const regularFile = `${PDF_ARABIC_FONT_NAME}-Regular.ttf`;
  const boldFile = `${PDF_ARABIC_FONT_NAME}-Bold.ttf`;
  pdf.addFileToVFS(regularFile, PDF_ARABIC_FONT_REGULAR_BASE64);
  pdf.addFont(regularFile, PDF_ARABIC_FONT_NAME, "normal");
  pdf.addFileToVFS(boldFile, PDF_ARABIC_FONT_BOLD_BASE64);
  pdf.addFont(boldFile, PDF_ARABIC_FONT_NAME, "bold");
  pdf.setFont(PDF_ARABIC_FONT_NAME, "normal");
}

/** Shape + reorder Arabic once for PDF drawing (Latin left unchanged). */
export function pdfCellText(value: string): string {
  if (!value) return value;
  return rtlText(value);
}
