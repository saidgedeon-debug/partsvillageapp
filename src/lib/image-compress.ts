/** Compress an image file to a JPEG data URL for cloud storage. */
export async function compressImageToDataUrl(
  file: File,
  opts?: { maxEdge?: number; quality?: number; maxChars?: number },
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 1400;
  const quality = opts?.quality ?? 0.72;
  const maxChars = opts?.maxChars ?? 700_000;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > maxChars && q > 0.4) {
    q -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  if (dataUrl.length > maxChars) {
    throw new Error("Photo is still too large after compression — try a clearer smaller photo");
  }
  return dataUrl;
}
