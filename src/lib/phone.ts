/** Default calling code for local Lebanese numbers (no +). */
export const DEFAULT_COUNTRY_CODE = "961";

/**
 * Normalize a phone to digits-only international (no +), suitable for wa.me.
 * Local Lebanese numbers (03…, 71…, 81…) get 961 prepended (leading 0 dropped).
 * Returns null if the result has fewer than 8 digits.
 */
export function normalizePhoneE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (!digits) return null;

  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    // already international
  } else if (digits.startsWith("0")) {
    digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  } else if (/^(3|7\d|81)/.test(digits) && digits.length <= 8) {
    digits = DEFAULT_COUNTRY_CODE + digits;
  } else if (digits.length <= 8) {
    digits = DEFAULT_COUNTRY_CODE + digits;
  }

  if (digits.length < 8) return null;
  return digits;
}

/** Pretty-print international digits for UI (e.g. +961 71 000 000). */
export function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith(DEFAULT_COUNTRY_CODE) && d.length > 3) {
    const rest = d.slice(DEFAULT_COUNTRY_CODE.length);
    if (rest.length === 8) {
      return `+${DEFAULT_COUNTRY_CODE} ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
    }
    if (rest.length === 7) {
      return `+${DEFAULT_COUNTRY_CODE} ${rest.slice(0, 1)} ${rest.slice(1, 4)} ${rest.slice(4)}`;
    }
    return `+${DEFAULT_COUNTRY_CODE} ${rest}`;
  }
  return `+${d}`;
}
