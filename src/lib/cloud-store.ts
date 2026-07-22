import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export type ShopStateKey =
  | "inventory"
  | "parties"
  | "documents"
  | "fleet"
  | "cart"
  | "kits"
  | "prefs";

const MIGRATE_FLAG = "parts-village-cloud-migrated-v1";

/** Read a shop_state JSON value from Supabase. */
export async function fetchShopState<T>(key: ShopStateKey, fallback: T): Promise<T> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("shop_state").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (data?.value == null) return fallback;
  return data.value as T;
}

/** Upsert shop_state JSON value. */
export async function saveShopState(key: ShopStateKey, value: unknown): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("shop_state").upsert({
    key,
    value: value as never,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * One-time: if cloud value is empty and localStorage has data, push local → cloud.
 */
export async function loadOrMigrateShopState<T>(
  key: ShopStateKey,
  localStorageKey: string,
  fallback: T,
  isEmpty: (v: T) => boolean,
): Promise<T> {
  const cloud = await fetchShopState<T>(key, fallback);
  if (!isEmpty(cloud)) return cloud;

  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return fallback;

    const local = JSON.parse(raw) as T;
    if (isEmpty(local)) return fallback;

    await saveShopState(key, local);
    return local;
  } catch {
    // ignore parse / migrate errors
  }
  return fallback;
}

export function markCloudMigrated() {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIGRATE_FLAG, "1");
}

/**
 * Hook: cloud is source of truth. Debounced save + realtime refresh.
 * No offline persistence after hydrate.
 */
export function useCloudState<T>(
  key: ShopStateKey,
  localStorageKey: string,
  fallback: T,
  isEmpty: (v: T) => boolean,
): {
  value: T;
  setValue: Dispatch<SetStateAction<T>>;
  ready: boolean;
  error: string | null;
} {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipSave = useRef(true);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadOrMigrateShopState(key, localStorageKey, fallback, isEmpty);
        if (cancelled) return;
        skipSave.current = true;
        setValue(loaded);
        setReady(true);
        markCloudMigrated();
        try {
          localStorage.removeItem(localStorageKey);
        } catch {
          // ignore
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load cloud data");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per key
  }, [key]);

  useEffect(() => {
    if (!ready || !isSupabaseConfigured) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void saveShopState(key, valueRef.current).catch((e) => {
        console.error(`Failed to save ${key}`, e);
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [value, ready, key]);

  useEffect(() => {
    if (!ready || !isSupabaseConfigured) return;
    const sb = requireSupabase();
    const channel = sb
      .channel(`shop_state:${key}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shop_state",
          filter: `key=eq.${key}`,
        },
        (payload) => {
          const next = (payload.new as { value?: T } | null)?.value;
          if (next === undefined) return;
          const cur = JSON.stringify(valueRef.current);
          const incoming = JSON.stringify(next);
          if (cur === incoming) return;
          skipSave.current = true;
          setValue(next);
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [ready, key]);

  return { value, setValue, ready, error };
}
