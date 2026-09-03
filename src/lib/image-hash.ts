/** Tiny average-hash for photo → part matching against existing part images. */

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 8×8 average hash as 64-bit hex string. */
export async function averageHashFromBlob(blob: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, 8, 8);
    bmp.close();
    const { data } = ctx.getImageData(0, 0, 8, 8);
    const vals: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      vals.push(luminance(data[i]!, data[i + 1]!, data[i + 2]!));
    }
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    let bits = "";
    for (const v of vals) bits += v >= avg ? "1" : "0";
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

export async function averageHashFromDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return averageHashFromBlob(blob);
  } catch {
    return null;
  }
}

/** Hamming distance between two hex hashes (0 = identical). */
export function hashDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number.parseInt(a[i]!, 16) ^ Number.parseInt(b[i]!, 16);
    dist += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
  }
  return dist;
}
