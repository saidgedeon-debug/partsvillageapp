import type { Part } from "@/lib/mock-data";

/** Primary product photo URL if the part has one. */
export function primaryPartImage(part: Pick<Part, "imageUrl" | "imageUrls">): string | undefined {
  const fromGallery = part.imageUrls?.find((url) => Boolean(url?.trim()));
  if (fromGallery) return fromGallery.trim();
  const single = part.imageUrl?.trim();
  return single || undefined;
}
