/**
 * Durable unlock / portal / Face ID rate limits in shop_state
 * (survives Vercel serverless cold starts).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const STORE_KEY = "operator_rate_limits";

type Bucket = { failures: number[]; lockedUntil?: number };
type Store = { buckets: Record<string, Bucket> };

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function adminClient() {
  const url = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Server missing Supabase URL or SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hashRateKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

async function loadStore(): Promise<Store> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("shop_state")
    .select("value")
    .eq("key", STORE_KEY)
    .maybeSingle();
  if (error) throw error;
  const val = data?.value as Store | null;
  if (!val || typeof val !== "object" || !val.buckets) return { buckets: {} };
  return { buckets: { ...val.buckets } };
}

async function saveStore(store: Store): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.from("shop_state").upsert({
    key: STORE_KEY,
    value: store,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

function prune(entry: Bucket, windowMs: number, now: number): Bucket {
  return {
    failures: (entry.failures ?? []).filter((t) => now - t < windowMs),
    lockedUntil: entry.lockedUntil && entry.lockedUntil > now ? entry.lockedUntil : undefined,
  };
}

export async function checkDurableRateLimit(
  key: string,
  opts: { windowMs: number; maxFailures: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const now = Date.now();
    const store = await loadStore();
    const entry = prune(store.buckets[key] ?? { failures: [] }, opts.windowMs, now);
    store.buckets[key] = entry;
    if (entry.lockedUntil && entry.lockedUntil > now) {
      return { ok: false, error: "Too many attempts — try again later" };
    }
    if (entry.failures.length >= opts.maxFailures) {
      entry.lockedUntil = now + opts.windowMs;
      store.buckets[key] = entry;
      await saveStore(store);
      return { ok: false, error: "Too many attempts — try again later" };
    }
    await saveStore(store);
    return { ok: true };
  } catch (e) {
    console.error(e);
    // Fail open on store errors so unlock isn't bricked; still log.
    return { ok: true };
  }
}

export async function recordDurableFailure(
  key: string,
  opts: { windowMs: number; maxFailures: number },
): Promise<void> {
  try {
    const now = Date.now();
    const store = await loadStore();
    const entry = prune(store.buckets[key] ?? { failures: [] }, opts.windowMs, now);
    entry.failures.push(now);
    if (entry.failures.length >= opts.maxFailures) {
      entry.lockedUntil = now + opts.windowMs;
    }
    store.buckets[key] = entry;
    await saveStore(store);
  } catch (e) {
    console.error(e);
  }
}

export async function clearDurableFailures(key: string): Promise<void> {
  try {
    const store = await loadStore();
    delete store.buckets[key];
    await saveStore(store);
  } catch (e) {
    console.error(e);
  }
}
