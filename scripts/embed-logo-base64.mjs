import fs from "node:fs";
import sharp from "sharp";

const buf = await sharp("src/assets/parts-village-logo-clear.png")
  .resize(480, 480, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const b64 = buf.toString("base64");
const src =
  "/** Auto-generated transparent Parts Village logo for PDF invoices. */\n" +
  `export const PARTS_VILLAGE_LOGO_PNG_BASE64 = \`${b64}\`;\n`;

fs.writeFileSync("src/lib/parts-village-logo-base64.ts", src);
console.log("wrote base64 logo", buf.length, "bytes");
