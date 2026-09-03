/** Parse spoken counter phrases into part codes + quantities. */

export type VoiceCartIntent = {
  code: string;
  qty: number;
};

const QTY_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/**
 * Examples:
 * - "add SPGW 50 by 60 qty 2"
 * - "PC200-7 seal two"
 * - "part A01-1 quantity 3"
 */
export function parseVoiceCartTranscript(raw: string): VoiceCartIntent[] {
  const text = raw
    .toLowerCase()
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];

  const intents: VoiceCartIntent[] = [];

  // "… qty/quantity/x N"
  const withQty =
    /(?:add|get|part)?\s*([a-z0-9][a-z0-9\-/.]{1,24})\s+(?:qty|quantity|x|times)\s+(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = withQty.exec(text))) {
    const code = normalizeSpokenCode(m[1]!);
    const qty = parseQtyToken(m[2]!);
    if (code && qty > 0) intents.push({ code, qty });
  }

  if (intents.length) return intents;

  // "N of CODE" / "CODE N"
  const alt =
    /(?:add|get)?\s*(?:(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:of\s+)?)?([a-z0-9][a-z0-9\-/.]{1,24})(?:\s+(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten))?/gi;
  while ((m = alt.exec(text))) {
    const code = normalizeSpokenCode(m[2]!);
    const qty = parseQtyToken(m[1] || m[3] || "1");
    if (code && qty > 0 && !/^(add|get|part|qty|quantity|times|of)$/i.test(code)) {
      intents.push({ code, qty });
    }
  }

  // Deduplicate by code (sum qty)
  const map = new Map<string, number>();
  for (const i of intents) {
    map.set(i.code, (map.get(i.code) ?? 0) + i.qty);
  }
  return [...map.entries()].map(([code, qty]) => ({ code, qty }));
}

function parseQtyToken(tok: string): number {
  const t = tok.trim().toLowerCase();
  if (QTY_WORDS[t] != null) return QTY_WORDS[t]!;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function normalizeSpokenCode(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "")
    .replace(/by/gi, "x")
    .toUpperCase();
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  );
}
