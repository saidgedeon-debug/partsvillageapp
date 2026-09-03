/** Generate or reuse a client portal access token. */

import { timingSafeEqualString } from "@/lib/timing-safe";

export const PORTAL_TOKEN_DAYS = 90;

function mintPortalToken(): string {
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

/** ISO expiry timestamp PORTAL_TOKEN_DAYS after `from` (default now). */
export function portalTokenExpiryIso(from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + PORTAL_TOKEN_DAYS);
  return d.toISOString();
}

/**
 * True when expiresAt is set and is strictly before now.
 * Missing/empty expiresAt is treated as not expired (legacy token-only).
 * Accepts full ISO or YYYY-MM-DD.
 */
export function isPortalTokenExpired(expiresAt?: string): boolean {
  const raw = expiresAt?.trim();
  if (!raw) return false;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

/**
 * Keep an existing token when present and not expired; otherwise mint a new one.
 * Always returns a concrete expiry ISO.
 */
export function ensurePortalToken(
  existing?: string,
  expiresAt?: string,
): { token: string; expiresAt: string } {
  const trimmed = existing?.trim();
  if (trimmed && !isPortalTokenExpired(expiresAt)) {
    return {
      token: trimmed,
      expiresAt: expiresAt?.trim() || portalTokenExpiryIso(),
    };
  }
  return { token: mintPortalToken(), expiresAt: portalTokenExpiryIso() };
}

/** Always mint a new portal token (revoke old implicitly). */
export function rotatePortalToken(): { token: string; expiresAt: string } {
  return { token: mintPortalToken(), expiresAt: portalTokenExpiryIso() };
}

/** Clear portal access until a new link is generated. */
export function revokePortalToken(): {
  portalToken: "";
  portalTokenExpiresAt: "";
} {
  return { portalToken: "", portalTokenExpiresAt: "" };
}

/** Build the client portal URL path with client id and token query params. */
export function portalPath(clientId: string, token: string): string {
  const params = new URLSearchParams({ c: clientId, t: token });
  return `/portal?${params.toString()}`;
}

/** True when the provided token matches the stored portal token and is not expired. */
export function verifyPortalToken(
  clientId: string,
  token: string,
  stored?: string,
  expiresAt?: string,
): boolean {
  if (!clientId || !token || !stored) return false;
  if (isPortalTokenExpired(expiresAt)) return false;
  return timingSafeEqualString(token, stored);
}
