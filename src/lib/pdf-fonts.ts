import { jsPDF } from "jspdf";
import { installJsPdfShaper, rtlText } from "bidi-shaper/jspdf";

import {
  PDF_ARABIC_FONT_BOLD_BASE64,
  PDF_ARABIC_FONT_NAME,
  PDF_ARABIC_FONT_REGULAR_BASE64,
} from "@/lib/pdf-arabic-font-base64";

export const PDF_FONT = PDF_ARABIC_FONT_NAME;

let shaperInstalled = false;

/** Register Amiri + Arabic BiDi shaping on a jsPDF instance. */
export function preparePdfFonts(pdf: jsPDF) {
  if (!shaperInstalled) {
    installJsPdfShaper(jsPDF.API as unknown as Parameters<typeof installJsPdfShaper>[0]);
    shaperInstalled = true;
  }
  const regularFile = `${PDF_ARABIC_FONT_NAME}-Regular.ttf`;
  const boldFile = `${PDF_ARABIC_FONT_NAME}-Bold.ttf`;
  pdf.addFileToVFS(regularFile, PDF_ARABIC_FONT_REGULAR_BASE64);
  pdf.addFont(regularFile, PDF_ARABIC_FONT_NAME, "normal");
  pdf.addFileToVFS(boldFile, PDF_ARABIC_FONT_BOLD_BASE64);
  pdf.addFont(boldFile, PDF_ARABIC_FONT_NAME, "bold");
  pdf.setFont(PDF_ARABIC_FONT_NAME, "normal");
}

/** Shape + reorder for autoTable cells (plugin may not cover them). */
export function pdfCellText(value: string): string {
  if (!value) return value;
  return rtlText(value);
}
