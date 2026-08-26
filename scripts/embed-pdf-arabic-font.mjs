/**
 * Subset Amiri for PDF embedding (Latin + Arabic + presentation forms).
 * Run: node scripts/embed-pdf-arabic-font.mjs
 */
import fs from "node:fs";
import subsetFont from "subset-font";

const regularPath = "src/assets/fonts/Amiri-Regular.ttf";
const boldPath = "src/assets/fonts/Amiri-Bold.ttf";

// Broad Arabic + Latin coverage so any future Arabic description renders.
const sample = [
  // Latin printable + common PDF UI strings
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  " .,;:!?@#$%&*()[]{}+-=_/\\\"'`°×—–·$€\n\t",
  "Parts Village HEAVY EQUIPMENT PARTS Bill to DOCUMENT Date Qty Price Total",
  "Amount Due Subtotal Discount Remaining Invoice paid in full PAYMENT DETAILS",
  "Note Supplier Cost Description Size Part Quotation Invoice Receipt Inquiry",
  "Credit Note TBD OMT Whish Cash USED PTO ZF divers",
  // Arabic letters (full alphabet) + digits + common words from quotes
  "ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهويىة",
  "٠١٢٣٤٥٦٧٨٩",
  "طرمبة ماء ميتسوبيشي مروحة قشاط صباب تعباية حديد كوليه فرام يد هينو طقم",
  "النوع رقم القطعة العدد سعر الوحدة المجموع الإجمالي قائمة قطع الغيار",
  "للزبون السيد شركة إلى الى العميل",
].join(" ");

async function subsetOne(inputPath) {
  const raw = fs.readFileSync(inputPath);
  // Include presentation forms range by passing arabic text through shaping chars
  // subset-font keeps glyphs for codepoints present in `sample` plus we add PFB explicitly.
  const pfb = Array.from({ length: 0xfeff - 0xfb50 + 1 }, (_, i) =>
    String.fromCodePoint(0xfb50 + i),
  ).join("");
  const out = await subsetFont(raw, sample + pfb, { targetFormat: "sfnt" });
  return { raw: raw.length, out };
}

const reg = await subsetOne(regularPath);
fs.writeFileSync("src/assets/fonts/Amiri-PDF-Regular.ttf", reg.out);
console.log("regular", reg.raw, "->", reg.out.length);

if (fs.existsSync(boldPath)) {
  const bold = await subsetOne(boldPath);
  fs.writeFileSync("src/assets/fonts/Amiri-PDF-Bold.ttf", bold.out);
  console.log("bold", bold.raw, "->", bold.out.length);
}

const b64Reg = Buffer.from(reg.out).toString("base64");
const boldBuf = fs.existsSync("src/assets/fonts/Amiri-PDF-Bold.ttf")
  ? fs.readFileSync("src/assets/fonts/Amiri-PDF-Bold.ttf")
  : reg.out;
const b64Bold = Buffer.from(boldBuf).toString("base64");

const src =
  "/** Auto-generated Amiri subset for Arabic PDF text (do not edit). */\n" +
  `export const PDF_ARABIC_FONT_NAME = "Amiri";\n` +
  `export const PDF_ARABIC_FONT_REGULAR_BASE64 = \`${b64Reg}\`;\n` +
  `export const PDF_ARABIC_FONT_BOLD_BASE64 = \`${b64Bold}\`;\n`;

fs.writeFileSync("src/lib/pdf-arabic-font-base64.ts", src);
console.log(
  "wrote src/lib/pdf-arabic-font-base64.ts",
  "regular chars",
  b64Reg.length,
  "bold chars",
  b64Bold.length,
);
