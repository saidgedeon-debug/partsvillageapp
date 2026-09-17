/** Normalize Supabase / fetch failures so the shop banner shows a real reason. */

export function formatCloudError(error: unknown, fallback: string): string {
  if (error == null) return fallback;
  if (typeof error === "string" && error.trim()) return error.trim();

  if (typeof error === "object") {
    const o = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      name?: unknown;
    };
    const parts = [o.message, o.code, o.details, o.hint]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      .map((part) => part.trim());
    if (parts.length > 0) return [...new Set(parts)].join(" · ");
    if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  }

  return fallback;
}

export function isRetryableCloudError(error: unknown): boolean {
  const text = formatCloudError(error, "").toLowerCase();
  if (!text) return true;
  return /fetch|network|timeout|timed out|abort|offline|429|502|503|504|500|jwt expired|session/.test(
    text,
  );
}

/** Postgres timestamptz often comes back as +00:00 while we stored ...Z. */
export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a === b;
  if (a === b) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isFinite(ta) && ta === tb;
}
