/** Normalize Arabic/Latin digits and loose part queries for forgiving search. */

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeSearchText(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/[٠-٩]/g, (ch) => String(ARABIC_DIGITS.indexOf(ch)));
  s = s.replace(/[۰-۹]/g, (ch) => String(EASTERN_DIGITS.indexOf(ch)));
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^\p{L}\p{N}\s.x×*-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Common spoken aliases
  s = s
    .replace(/\bo[\s-]?rings?\b/g, "o-ring")
    .replace(/\bo[\s-]?ring\b/g, "o-ring")
    .replace(/\bx\b/g, " ")
    .replace(/×/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return normalizeSearchText(s).split(" ").filter(Boolean);
}

/** Higher = better. Exact code match wins hard. */
export function scoreFuzzyMatch(query: string, haystack: string): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const h = normalizeSearchText(haystack);
  if (!h) return 0;
  if (h === q) return 1000;
  if (h.startsWith(q)) return 800;
  if (h.includes(q)) return 600;
  const qt = tokens(query);
  const ht = tokens(haystack);
  if (qt.length === 0) return 0;
  let hits = 0;
  for (const t of qt) {
    if (ht.some((x) => x === t || x.startsWith(t) || t.startsWith(x) || x.includes(t))) {
      hits += 1;
    }
  }
  if (hits === 0) return 0;
  return Math.round((hits / qt.length) * 400);
}

export function rankByFuzzyScore<T>(
  items: T[],
  query: string,
  getHaystack: (item: T) => string,
  limit = 20,
): T[] {
  const q = query.trim();
  if (!q) return [];
  return items
    .map((item) => ({ item, score: scoreFuzzyMatch(q, getHaystack(item)) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}
