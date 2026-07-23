/** Server-side Titus HTML / JSON scrape helpers (no credentials stored here). */

export type TitusOrderRow = {
  orderNo: string;
  description: string;
  chinaTracking?: string;
  cartons?: number;
  weightKg?: number;
  volumeCbm?: number;
  warehouse?: string;
  destination?: string;
  freightMode?: string;
  /** Titus stage label: Planned, pre-arranged, Loaded, Delivered… */
  titusStatus?: string;
  orderedAt?: string;
  /** Container / flight / shipment group e.g. AIR6068 */
  containerNo?: string;
  etd?: string;
  eta?: string;
  /** Titus freight due (USD) */
  freightCost?: number;
  /** Titus pb stage code when known */
  pb?: string;
};

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function num(v?: string | number | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function dateOnly(v?: string | null): string | undefined {
  if (!v) return undefined;
  const m = String(v).match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

/** Map Titus pb code + free-text status → display stage. */
export function deriveTitusStage(pb?: string | number | null, statusText?: string): string {
  const s = stripTags(statusText ?? "").toLowerCase();
  if (s.includes("deliver") || s.includes("signed") || s.includes("签收")) return "Delivered";
  if (s.includes("loaded") || s.includes("已装")) return "Loaded";
  if (s.includes("pre-arranged") || s.includes("prearranged") || s.includes("预排"))
    return "pre-arranged";
  if (s.includes("planned") || s.includes("计划")) return "Planned";
  if (s.includes("waiting") || s.includes("待装")) return "Waiting to load";
  if (s.includes("generated")) return "Generated";
  if (s.includes("received")) {
    // Received notifications often sit on early stages — prefer pb
  }

  const code = String(pb ?? "").trim();
  const pbMap: Record<string, string> = {
    "1": "Generated",
    "2": "Waiting to load",
    "3": "pre-arranged",
    "4": "Planned",
    "5": "Loaded",
    "6": "Delivered",
  };
  if (pbMap[code]) return pbMap[code];
  if (s.includes("received")) return "Received";
  return statusText ? stripTags(statusText).slice(0, 60) : "Unknown";
}

/** Parse order rows from hy_order.php?act=list HTML. */
export function parseTitusOrderListHtml(html: string): TitusOrderRow[] {
  const byOrder = new Map<string, TitusOrderRow>();
  const rowRe = /<tr class="tr_html_\d+">([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const body = m[1];
    const tds = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) =>
      stripTags(x[1]),
    );
    const orderNo = (tds[1] ?? "").trim().toUpperCase();
    if (!orderNo || orderNo.length < 4) continue;

    const orderedRaw = (tds[17] ?? "").trim();
    const orderedAt = orderedRaw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const listStatus = (tds[14] ?? "").trim();
    const container = (tds[5] ?? "").trim();

    byOrder.set(orderNo, {
      orderNo,
      description: (tds[6] ?? "").trim() || orderNo,
      chinaTracking: (tds[7] ?? "").trim() || undefined,
      cartons: num(tds[8]),
      weightKg: num(tds[9]),
      volumeCbm: num(tds[10]),
      warehouse: (tds[11] ?? "").trim() || undefined,
      destination: (tds[12] ?? "").trim() || undefined,
      freightMode: (tds[4] || tds[13] || "").trim() || undefined,
      titusStatus: listStatus ? deriveTitusStage(undefined, listStatus) : undefined,
      containerNo: container || undefined,
      orderedAt,
    });
  }
  return [...byOrder.values()];
}

type XxtzItem = Record<string, unknown>;

/** Parse mobile my_order.php?act=get_xxtz JSON (Status feed). */
export function parseTitusXxtzJson(raw: string): TitusOrderRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const root = parsed as { html?: { Status?: XxtzItem[] }; Status?: XxtzItem[] };
  const list = root.html?.Status ?? root.Status ?? [];
  if (!Array.isArray(list)) return [];

  const byOrder = new Map<string, TitusOrderRow>();
  for (const item of list) {
    const orderNo = String(item.rucang_no ?? "")
      .trim()
      .toUpperCase();
    if (!orderNo || orderNo.length < 4) continue;

    const freightCost =
      num(item.sale_sum as string) ?? num(item.yunfei as string) ?? undefined;
    const etd = dateOnly((item.zg_etd as string) || (item.etd as string));
    const eta = dateOnly(
      (item.zg_eta as string) || (item.eta as string) || (item.new_eta as string),
    );
    const containerNo = String(item.hgh ?? "")
      .trim()
      .toUpperCase() || undefined;
    const pb = item.pb != null ? String(item.pb) : undefined;
    const statusText = String(item.status ?? "");
    const titusStatus = deriveTitusStage(pb, statusText);
    const row: TitusOrderRow = {
      orderNo,
      description: String(item.pname_en_huizong || item.pname_en || item.pname || orderNo).trim(),
      chinaTracking: String(item.sid ?? "").trim() || undefined,
      cartons: num(item.nums as string),
      weightKg: num(item.weight as string),
      volumeCbm: num(item.tiji as string),
      warehouse: String(item.chqd ?? "").trim() || undefined,
      destination: String(item.Destination ?? item.country ?? "").trim() || undefined,
      freightMode: undefined,
      titusStatus,
      containerNo,
      etd,
      eta,
      freightCost: freightCost && freightCost > 0 ? freightCost : undefined,
      pb,
      orderedAt: dateOnly(item.addtime as string),
    };

    const prev = byOrder.get(orderNo);
    byOrder.set(orderNo, prev ? mergeTitusRows(prev, row) : row);
  }
  return [...byOrder.values()];
}

/** Prefer non-empty / higher-cost / later-stage fields when merging sources. */
export function mergeTitusRows(a: TitusOrderRow, b: TitusOrderRow): TitusOrderRow {
  const stageRank = (s?: string) => {
    const x = (s ?? "").toLowerCase();
    if (x.includes("deliver")) return 60;
    if (x.includes("load")) return 50;
    if (x.includes("planned")) return 40;
    if (x.includes("pre-arranged") || x.includes("prearranged")) return 30;
    if (x.includes("waiting")) return 20;
    if (x.includes("generated") || x.includes("received")) return 10;
    return 0;
  };

  const pickCost =
    (b.freightCost ?? 0) > (a.freightCost ?? 0) ? b.freightCost : a.freightCost ?? b.freightCost;
  const pickStatus =
    stageRank(b.titusStatus) >= stageRank(a.titusStatus) ? b.titusStatus : a.titusStatus;

  return {
    orderNo: a.orderNo,
    description: b.description || a.description,
    chinaTracking: b.chinaTracking || a.chinaTracking,
    cartons: b.cartons ?? a.cartons,
    weightKg: b.weightKg ?? a.weightKg,
    volumeCbm: b.volumeCbm ?? a.volumeCbm,
    warehouse: b.warehouse || a.warehouse,
    destination: b.destination || a.destination,
    freightMode: b.freightMode || a.freightMode,
    titusStatus: pickStatus || a.titusStatus || b.titusStatus,
    orderedAt: b.orderedAt || a.orderedAt,
    containerNo: b.containerNo || a.containerNo,
    etd: b.etd || a.etd,
    eta: b.eta || a.eta,
    freightCost: pickCost && pickCost > 0 ? pickCost : undefined,
    pb: b.pb || a.pb,
  };
}

/** Extract container codes (hgh=…) from mobile list HTML. */
export function extractTitusContainerCodes(html: string): string[] {
  const codes = new Set<string>();
  for (const m of html.matchAll(/[?&]hgh=([A-Za-z0-9\-]+)/g)) {
    const c = m[1].trim().toUpperCase();
    if (c) codes.add(c);
  }
  for (const m of html.matchAll(/Shipment[：:]\s*([A-Z]{2,}\d+)/gi)) {
    codes.add(m[1].toUpperCase());
  }
  return [...codes];
}

/**
 * Parse mobile list card HTML (my_order.php?act=list AJAX).
 * Cards often omit GA# — used mainly to discover containers + stage labels.
 */
export function parseTitusMobileListCards(html: string): Array<{
  containerNo?: string;
  titusStatus?: string;
  freightCost?: number;
  etd?: string;
  eta?: string;
  cartons?: number;
  volumeCbm?: number;
  weightKg?: number;
}> {
  const cards: Array<{
    containerNo?: string;
    titusStatus?: string;
    freightCost?: number;
    etd?: string;
    eta?: string;
    cartons?: number;
    volumeCbm?: number;
    weightKg?: number;
  }> = [];

  const parts = html.split(/<a\s+href="/i).slice(1);
  for (const part of parts) {
    const chunk = part.slice(0, part.indexOf("</a>") >= 0 ? part.indexOf("</a>") : part.length);
    const text = stripTags(chunk);
    const label = chunk.match(/label-item[^>]*>([^<]+)</i)?.[1]?.trim();
    const container =
      text.match(/Shipment[：:]\s*([A-Z0-9\-]+)/i)?.[1]?.toUpperCase() ||
      chunk.match(/hgh=([A-Za-z0-9\-]+)/)?.[1]?.toUpperCase();
    const cost = num(text.match(/([\d.]+)\s*\$/)?.[1]);
    const etd = dateOnly(text.match(/ETD[：:]\s*([\d\-]+)/i)?.[1]);
    const eta = dateOnly(text.match(/ETA[：:]\s*([\d\-]+)/i)?.[1]);
    const totals = text.match(
      /Total[：:]\s*([\d.]+)\s*CTN\s*-\s*([\d.]+)\s*CBM\s*-\s*([\d.]+)\s*KG/i,
    );
    if (!label && !container && cost == null) continue;
    cards.push({
      containerNo: container || undefined,
      titusStatus: label ? deriveTitusStage(undefined, label) : undefined,
      freightCost: cost && cost > 0 ? cost : undefined,
      etd,
      eta,
      cartons: totals ? num(totals[1]) : undefined,
      volumeCbm: totals ? num(totals[2]) : undefined,
      weightKg: totals ? num(totals[3]) : undefined,
    });
  }
  return cards;
}

export function loginSucceeded(html: string): boolean {
  const lower = html.toLowerCase();
  if (lower.includes("act=logout") || lower.includes("enter member center")) return true;
  if (lower.includes("incorrect") || lower.includes("wrong password")) return false;
  return lower.includes("member") && !lower.includes('name="username"');
}
