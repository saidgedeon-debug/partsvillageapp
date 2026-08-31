/** Generate or reuse a client portal access token. */
export function ensurePortalToken(existing?: string): string {
  const trimmed = existing?.trim();
  if (trimmed) return trimmed;
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build the client portal URL path with client id and token query params. */
export function portalPath(clientId: string, token: string): string {
  const params = new URLSearchParams({ c: clientId, t: token });
  return `/portal?${params.toString()}`;
}

/** True when the provided token matches the stored portal token for the client. */
export function verifyPortalToken(clientId: string, token: string, stored?: string): boolean {
  if (!clientId || !token || !stored) return false;
  return token === stored;
}
