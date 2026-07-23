import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  extractTitusContainerCodes,
  loginSucceeded,
  mergeTitusRows,
  parseTitusMobileListCards,
  parseTitusOrderListHtml,
  parseTitusXxtzJson,
  type TitusOrderRow,
} from "@/lib/titus-scrape";

const TITUS_ORIGIN = "https://login.titus-logistics.com";
const CREDS_KEY = "parts-village-titus-creds-v1";
const LAST_SYNC_KEY = "parts-village-titus-last-sync-v1";

export type TitusCreds = { username: string; password: string };

export type TitusSyncResult = {
  ok: true;
  orders: TitusOrderRow[];
  count: number;
};

export type TitusSyncError = {
  ok: false;
  error: string;
};

const inputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function cookieJar() {
  const jar = new Map<string, string>();
  return {
    store(res: Response) {
      const raw = res.headers.getSetCookie?.() ?? [];
      const fallback = res.headers.get("set-cookie");
      const parts = raw.length ? raw : fallback ? [fallback] : [];
      for (const line of parts) {
        const pair = line.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq <= 0) continue;
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function fetchText(
  url: string,
  cookie: ReturnType<typeof cookieJar>,
  init?: RequestInit,
): Promise<{ res: Response; text: string }> {
  const res = await fetch(url, {
    ...init,
    redirect: "follow",
    headers: {
      ...(init?.headers ?? {}),
      Cookie: cookie.header(),
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    },
  });
  cookie.store(res);
  const text = await res.text();
  return { res, text };
}

function upsert(map: Map<string, TitusOrderRow>, row: TitusOrderRow) {
  const prev = map.get(row.orderNo);
  map.set(row.orderNo, prev ? mergeTitusRows(prev, row) : row);
}

/** Enrich rows that share a container using mobile card aggregates (status/ETD/ETA). */
function applyContainerCardHints(map: Map<string, TitusOrderRow>, html: string) {
  const cards = parseTitusMobileListCards(html);
  for (const card of cards) {
    if (!card.containerNo) continue;
    for (const [orderNo, row] of map) {
      if ((row.containerNo ?? "").toUpperCase() !== card.containerNo) continue;
      upsert(map, {
        ...row,
        orderNo,
        description: row.description,
        titusStatus: card.titusStatus || row.titusStatus,
        etd: card.etd || row.etd,
        eta: card.eta || row.eta,
        // Don't overwrite per-order freight with container totals
      });
    }
  }
}

/** Login to Titus and pull desktop list + mobile status feed (cost / ETA / ETD / stage). */
export const syncTitusOrders = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<TitusSyncResult | TitusSyncError> => {
    const cookie = cookieJar();
    const commonHeaders = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      "Accept-Language": "en-US,en;q=0.9",
    };

    await fetchText(`${TITUS_ORIGIN}/index.php?lang=en_us`, cookie, {
      headers: commonHeaders,
    });
    await fetchText(`${TITUS_ORIGIN}/mobile/index.php?lang=en_us`, cookie, {
      headers: commonHeaders,
    });

    const body = new URLSearchParams({
      username: data.username,
      password: data.password,
      act: "act_login",
    });

    const login = await fetchText(`${TITUS_ORIGIN}/user.php?lang=en_us`, cookie, {
      method: "POST",
      headers: {
        ...commonHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!loginSucceeded(login.text) && !cookie.header().includes("ECS[username]")) {
      return { ok: false, error: "Titus login failed — check user / password" };
    }

    const byOrder = new Map<string, TitusOrderRow>();

    // Desktop list (order #, description, list status)
    const desktopUrls = [
      `${TITUS_ORIGIN}/hy_order.php?act=list&lang=en_us&search_types=rucang_no&keywords=`,
      `${TITUS_ORIGIN}/hy_order.php?act=list&lang=en_us&pb=3&search_types=rucang_no&keywords=`,
      `${TITUS_ORIGIN}/hy_order.php?act=list&lang=en_us&pb=5&search_types=rucang_no&keywords=`,
      `${TITUS_ORIGIN}/hy_order.php?act=list&lang=en_us&pb=6&search_types=rucang_no&keywords=`,
    ];
    for (const url of desktopUrls) {
      const page = await fetchText(url, cookie, { headers: commonHeaders });
      for (const row of parseTitusOrderListHtml(page.text)) upsert(byOrder, row);
    }

    // Mobile status feed — freight cost, ETD, ETA, container, stage
    for (let page = 1; page <= 8; page++) {
      const feed = await fetchText(
        `${TITUS_ORIGIN}/mobile/my_order.php?act=get_xxtz&page=${page}&lang=en_us`,
        cookie,
        {
          method: "POST",
          headers: {
            ...commonHeaders,
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );
      const rows = parseTitusXxtzJson(feed.text);
      if (rows.length === 0) break;
      for (const row of rows) upsert(byOrder, row);
    }

    // Mobile list cards — discover containers + stage labels (Planned / Loaded…)
    const containers = new Set<string>();
    const mobileListUrls = [
      `${TITUS_ORIGIN}/mobile/my_order.php?act=list&page_size=50&page=1&rucang_no=&hgh=&full_page=1&pb=3&order_types=&fk=&ys_status=all&start_date=&end_date=&hghs=`,
      `${TITUS_ORIGIN}/mobile/my_order.php?act=list&page_size=50&page=1&rucang_no=&hgh=&full_page=1&pb=5&order_types=&fk=&ys_status=all&start_date=&end_date=&hghs=`,
      `${TITUS_ORIGIN}/mobile/my_order.php?act=list&page_size=50&page=1&rucang_no=&hgh=&full_page=1&pb=6&order_types=&fk=&ys_status=all&start_date=&end_date=&hghs=`,
    ];
    for (const url of mobileListUrls) {
      const page = await fetchText(url, cookie, {
        method: "POST",
        headers: {
          ...commonHeaders,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      for (const c of extractTitusContainerCodes(page.text)) containers.add(c);
      applyContainerCardHints(byOrder, page.text);
    }

    // Drill into each container (e.g. AIR6068) for Loaded cards with $ / ETD / ETA
    for (const hgh of containers) {
      for (const pb of ["", "5", "6"]) {
        const url =
          `${TITUS_ORIGIN}/mobile/my_order.php?act=list&page_size=50&page=1` +
          `&rucang_no=&hgh=${encodeURIComponent(hgh)}&full_page=1&pb=${pb}` +
          `&order_types=&fk=&ys_status=all&start_date=&end_date=&hghs=`;
        const page = await fetchText(url, cookie, {
          method: "POST",
          headers: {
            ...commonHeaders,
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        applyContainerCardHints(byOrder, page.text);

        // Match per-order freight from cards when weight/ctns uniquely match
        const cards = parseTitusMobileListCards(page.text);
        for (const card of cards) {
          if (card.freightCost == null) continue;
          const matches = [...byOrder.values()].filter((r) => {
            if ((r.containerNo ?? "").toUpperCase() !== hgh) return false;
            if (card.cartons != null && r.cartons != null && card.cartons !== r.cartons)
              return false;
            if (
              card.weightKg != null &&
              r.weightKg != null &&
              Math.abs(card.weightKg - r.weightKg) > 0.05
            ) {
              return false;
            }
            return true;
          });
          if (matches.length === 1) {
            const only = matches[0];
            upsert(byOrder, {
              ...only,
              freightCost: card.freightCost,
              etd: card.etd || only.etd,
              eta: card.eta || only.eta,
              titusStatus: card.titusStatus || only.titusStatus,
              containerNo: hgh,
            });
          }
        }
      }
    }

    const orders = [...byOrder.values()].sort((a, b) =>
      (b.orderedAt ?? b.eta ?? "").localeCompare(a.orderedAt ?? a.eta ?? ""),
    );

    if (orders.length === 0) {
      return {
        ok: false,
        error: "Logged in but found 0 orders — Titus page layout may have changed",
      };
    }

    return { ok: true, orders, count: orders.length };
  });

export function loadTitusCreds(): TitusCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TitusCreds;
    if (!parsed?.username || !parsed?.password) return null;
    return { username: String(parsed.username), password: String(parsed.password) };
  } catch {
    return null;
  }
}

export function saveTitusCreds(creds: TitusCreds) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CREDS_KEY,
    JSON.stringify({
      username: creds.username.trim(),
      password: creds.password,
    }),
  );
}

export function clearTitusCreds() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CREDS_KEY);
}

export function loadLastTitusSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function markTitusSyncedNow() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}
