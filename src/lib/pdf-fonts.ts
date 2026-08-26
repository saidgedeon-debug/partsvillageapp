import {
  PDF_ARABIC_FONT_NAME,
  PDF_ARABIC_FONT_REGULAR_BASE64,
} from "@/lib/pdf-arabic-font-base64";
import type { jsPDF } from "jspdf";

/** Keep Amiri name for any remaining jsPDF Latin text. */
export const PDF_FONT = PDF_ARABIC_FONT_NAME;

const ARABIC_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabic(value: string): boolean {
  return ARABIC_RE.test(value);
}

const FONT_FAMILY = "PartsVillageAmiri";

let fontLoad: Promise<void> | null = null;

/** Load Amiri into document.fonts so canvas matches in-app Arabic rendering. */
export function ensurePdfArabicFont(): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }
  if (!fontLoad) {
    fontLoad = (async () => {
      const already = [...document.fonts].some((f) => f.family === FONT_FAMILY);
      if (already) return;
      const face = new FontFace(
        FONT_FAMILY,
        `url(data:font/ttf;base64,${PDF_ARABIC_FONT_REGULAR_BASE64})`,
      );
      const loaded = await face.load();
      document.fonts.add(loaded);
      await document.fonts.ready;
    })().catch((err) => {
      fontLoad = null;
      throw err;
    });
  }
  return fontLoad;
}

export type ArabicPng = {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
};

/**
 * Render logical Arabic (or mixed) text with the browser text engine —
 * same shaping the app UI uses — then embed as a PNG in the PDF.
 */
export function renderArabicPng(
  text: string,
  opts: {
    /** jsPDF font size in pt */
    fontPt: number;
    /** Max width in mm */
    maxWidthMm: number;
    color?: string;
    align?: "left" | "right";
  },
): ArabicPng {
  const scale = 3;
  const pxPerMm = (96 / 25.4) * scale;
  const fontPx = opts.fontPt * (96 / 72) * scale;
  const maxWidthPx = Math.max(8, opts.maxWidthMm * pxPerMm);
  const color = opts.color ?? "#0B1F33";
  const align = opts.align ?? "right";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: "", widthMm: 0, heightMm: 0 };
  }

  ctx.font = `${fontPx}px "${FONT_FAMILY}"`;
  ctx.direction = "rtl";
  const measured = ctx.measureText(text);
  const textW = Math.min(Math.ceil(measured.width) + 2, Math.ceil(maxWidthPx));
  const textH = Math.ceil(fontPx * 1.45);

  canvas.width = textW;
  canvas.height = textH;

  ctx.font = `${fontPx}px "${FONT_FAMILY}"`;
  ctx.direction = "rtl";
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align === "right" ? "right" : "left";
  const x = align === "right" ? textW - 1 : 1;
  ctx.fillText(text, x, textH / 2, maxWidthPx);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: textW / pxPerMm,
    heightMm: textH / pxPerMm,
  };
}

/** Draw Arabic (or mixed) text via canvas image; Latin-only uses pdf.text. */
export function pdfDrawText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  opts?: {
    align?: "left" | "right" | "center";
    maxWidthMm?: number;
    color?: string;
    fontStyle?: "normal" | "bold";
  },
) {
  if (!text) return;
  if (!hasArabic(text)) {
    pdf.text(text, x, y, opts?.align ? { align: opts.align } : undefined);
    return;
  }
  const fontPt = pdf.getFontSize();
  const img = renderArabicPng(text, {
    fontPt,
    maxWidthMm: opts?.maxWidthMm ?? 80,
    color: opts?.color,
    align: opts?.align === "left" ? "left" : "right",
  });
  if (!img.dataUrl) return;
  let drawX = x;
  if (opts?.align === "right") drawX = x - img.widthMm;
  else if (opts?.align === "center") drawX = x - img.widthMm / 2;
  // pdf.text y is baseline; images use top-left — nudge up by ~0.7 of height
  const drawY = y - img.heightMm * 0.72;
  pdf.addImage(img.dataUrl, "PNG", drawX, drawY, img.widthMm, img.heightMm);
}
