/** Keep shop_state JSON under PostgREST / phone-network limits after photos are offloaded. */
export const SHOP_STATE_SOFT_MAX_CHARS = 900_000;

export function sanitizeShopStateJson(value: unknown): unknown {
  if (typeof value === "string") {
    return value.includes("\u0000") ? value.replace(/\u0000/g, "") : value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const mapped = sanitizeShopStateJson(item);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const mapped = sanitizeShopStateJson(nested);
      if (mapped !== nested) changed = true;
      out[key] = mapped;
    }
    return changed ? out : value;
  }
  return value;
}

export function stripInlineDataUrls(value: unknown): unknown {
  if (typeof value === "string") return value.startsWith("data:") ? "" : value;
  if (Array.isArray(value)) {
    let changed = false;
    const next: unknown[] = [];
    for (const item of value) {
      const mapped = stripInlineDataUrls(item);
      if (mapped === "") {
        changed = true;
        continue;
      }
      if (mapped !== item) changed = true;
      next.push(mapped);
    }
    return changed ? next : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const mapped = stripInlineDataUrls(nested);
      if (mapped !== nested) changed = true;
      if (mapped === "") {
        changed = true;
        continue;
      }
      out[key] = mapped;
    }
    return changed ? out : value;
  }
  return value;
}

export function shopStatePayloadChars(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

async function offloadNode(value: unknown, folder: string): Promise<unknown> {
  const { uploadShopImageDataUrl } = await import("./part-image-storage");
  const walk = async (node: unknown): Promise<unknown> => {
    if (typeof node === "string") {
      if (!node.startsWith("data:image")) return node;
      return uploadShopImageDataUrl(node, folder);
    }
    if (Array.isArray(node)) {
      const next = await Promise.all(node.map((item) => walk(item)));
      return next.some((item, i) => item !== node[i]) ? next : node;
    }
    if (node && typeof node === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      const out: Record<string, unknown> = {};
      let changed = false;
      for (const [key, nested] of entries) {
        const mapped = await walk(nested);
        if (mapped !== nested) changed = true;
        out[key] = mapped;
      }
      return changed ? out : node;
    }
    return node;
  };
  return walk(value);
}

export async function prepareShopStateValue(key: string, value: unknown): Promise<unknown> {
  const sanitized = sanitizeShopStateJson(value);
  const offloaded = await offloadNode(sanitized, key);
  if (shopStatePayloadChars(offloaded) <= SHOP_STATE_SOFT_MAX_CHARS) return offloaded;
  return stripInlineDataUrls(offloaded);
}
