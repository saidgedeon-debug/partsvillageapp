import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const BUCKET = "part-photos";

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || "image/jpeg";
  const isBase64 = Boolean(match[2]);
  const data = match[3] || "";
  try {
    if (isBase64) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(data)], { type: mime });
  } catch {
    return null;
  }
}

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Upload a compressed part photo data URL to Supabase Storage when configured.
 * Returns a public URL on success, otherwise the original dataUrl (local fallback).
 */
export async function uploadPartImageDataUrl(
  dataUrl: string,
  partId: string,
): Promise<string> {
  if (!dataUrl.startsWith("data:") || !isSupabaseConfigured || !supabase) {
    return dataUrl;
  }

  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return dataUrl;

  const safePart = (partId || "part").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
  const ext = extForMime(blob.type || "image/jpeg");
  const path = `${safePart}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      // Bucket may be missing — try create then retry once.
      if (/bucket|not found|does not exist/i.test(uploadError.message)) {
        try {
          await supabase.storage.createBucket(BUCKET, { public: true });
        } catch {
          // ignore — migration may own bucket creation
        }
        const retry = await supabase.storage.from(BUCKET).upload(path, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false,
        });
        if (retry.error) return dataUrl;
      } else {
        return dataUrl;
      }
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || dataUrl;
  } catch {
    return dataUrl;
  }
}
