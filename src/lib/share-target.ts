/** Read files stashed by the service worker after a Web Share Target POST. */

const SHARE_CACHE = "pv-share-inbox-v1";

export type SharedPendingMeta = {
  title: string;
  text: string;
  url: string;
  receivedAt: string;
  files: Array<{ key: string; name: string; type: string; size: number }>;
};

export type SharedPendingFile = {
  name: string;
  type: string;
  size: number;
  blob: Blob;
};

export async function takeSharedPending(): Promise<{
  meta: SharedPendingMeta;
  files: SharedPendingFile[];
} | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(SHARE_CACHE);
  const metaRes = await cache.match("pending");
  if (!metaRes) return null;

  const meta = (await metaRes.json()) as SharedPendingMeta;
  const files: SharedPendingFile[] = [];
  for (const f of meta.files ?? []) {
    const res = await cache.match(f.key);
    if (!res) continue;
    const blob = await res.blob();
    files.push({
      name: f.name,
      type: f.type || blob.type || "application/octet-stream",
      size: f.size || blob.size,
      blob,
    });
    await cache.delete(f.key);
  }
  await cache.delete("pending");
  if (files.length === 0 && !meta.text && !meta.url) return null;
  return { meta, files };
}

export function registerShareServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("SW register failed", e);
    });
  });
}
