/* Parts Village — share target + light offline shell */
const CACHE = "pv-shell-v1";
const SHARE_CACHE = "pv-share-inbox-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/", "/share-inbox", "/manifest.webmanifest"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Web Share Target POST → stash files → redirect to inbox
  if (event.request.method === "POST" && url.pathname === "/share") {
    event.respondWith(handleSharePost(event.request));
    return;
  }
});

async function handleSharePost(request) {
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") || "");
    const text = String(formData.get("text") || "");
    const sharedUrl = String(formData.get("url") || "");
    const files = formData.getAll("files").filter((f) => f && typeof f === "object" && "size" in f);

    const cache = await caches.open(SHARE_CACHE);
    await cache.delete("pending");

    const meta = {
      title,
      text,
      url: sharedUrl,
      receivedAt: new Date().toISOString(),
      files: files.map((f, i) => ({
        key: `file-${i}`,
        name: f.name || `shared-${i}`,
        type: f.type || "application/octet-stream",
        size: f.size || 0,
      })),
    };

    await cache.put(
      "pending",
      new Response(JSON.stringify(meta), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    for (let i = 0; i < files.length; i++) {
      await cache.put(`file-${i}`, new Response(files[i]));
    }

    return Response.redirect("/share-inbox?received=1", 303);
  } catch (err) {
    console.error("share target failed", err);
    return Response.redirect("/share-inbox?error=1", 303);
  }
}
