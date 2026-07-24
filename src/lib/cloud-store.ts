import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export type ShopStateKey =
  | "inventory"
  | "parties"
  | "documents"
  | "fleet"
  | "cart"
  | "kits"
  | "prefs"
  | "shipments"
  | "share-inbox";

const MIGRATE_FLAG = "parts-village-cloud-migrated-v1";

/** Read a shop_state JSON value from Supabase. */
export async function fetchShopState<T>(key: ShopStateKey, fallback: T): Promise<T> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("shop_state").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (data?.value == null) return fallback;
  return data.value as T;
}

/** Read value + updated_at for optimistic concurrency. */
async function fetchShopStateRow<T>(
  key: ShopStateKey,
): Promise<{ value: T | null; updatedAt: string | null }> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("shop_state")
    .select("value, updated_at")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return {
    value: (data?.value as T | null | undefined) ?? null,
    updatedAt: (data?.updated_at as string | null | undefined) ?? null,
  };
}

/**
 * Upsert shop_state JSON value.
 * When `expectedUpdatedAt` is set, refuses to overwrite a newer remote revision
 * (optimistic concurrency). Returns whether the write landed.
 */
export async function saveShopState(
  key: ShopStateKey,
  value: unknown,
  expectedUpdatedAt?: string | null,
): Promise<{ saved: boolean; updatedAt: string | null }> {
  const sb = requireSupabase();

  if (expectedUpdatedAt) {
    const remote = await fetchShopStateRow(key);
    if (remote.updatedAt && remote.updatedAt !== expectedUpdatedAt) {
      return { saved: false, updatedAt: remote.updatedAt };
    }
  }

  const updatedAt = new Date().toISOString();
  const { error } = await sb.from("shop_state").upsert({
    key,
    value: value as never,
    updated_at: updatedAt,
  });
  if (error) throw error;
  return { saved: true, updatedAt };
}

/**
 * One-time: if cloud value is empty and localStorage has data, push local → cloud.
 */
export async function loadOrMigrateShopState<T>(
  key: ShopStateKey,
  localStorageKey: string,
  fallback: T,
  isEmpty: (v: T) => boolean,
): Promise<{ value: T; updatedAt: string | null }> {
  const row = await fetchShopStateRow<T>(key);
  if (row.value != null && !isEmpty(row.value)) {
    return { value: row.value, updatedAt: row.updatedAt };
  }

  if (typeof window === "undefined") return { value: fallback, updatedAt: null };

  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return { value: fallback, updatedAt: row.updatedAt };

    const local = JSON.parse(raw) as T;
    if (isEmpty(local)) return { value: fallback, updatedAt: row.updatedAt };

    const saved = await saveShopState(key, local);
    return { value: local, updatedAt: saved.updatedAt };
  } catch {
    // ignore parse / migrate errors
  }
  return { value: fallback, updatedAt: row.updatedAt };
}

export function markCloudMigrated() {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIGRATE_FLAG, "1");
}

/**
 * Hook: cloud is source of truth. Debounced save + realtime refresh.
 * Local dirty edits are not discarded by incoming realtime until saved.
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
  const [value, setValueState] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipSave = useRef(true);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const baseUpdatedAtRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const setValue: Dispatch<SetStateAction<T>> = (action) => {
    setValueState((prev) => {
      const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      if (!skipSave.current) dirtyRef.current = true;
      return next;
    });
  };

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
        dirtyRef.current = false;
        baseUpdatedAtRef.current = loaded.updatedAt;
        setValueState(loaded.value);
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
      if (savingRef.current) return;
      savingRef.current = true;
      const snapshot = valueRef.current;
      const expected = baseUpdatedAtRef.current;
      void saveShopState(key, snapshot, expected)
        .then((result) => {
          if (result.saved) {
            baseUpdatedAtRef.current = result.updatedAt;
            // Only clear dirty if nothing newer was typed during the save.
            if (valueRef.current === snapshot || JSON.stringify(valueRef.current) === JSON.stringify(snapshot)) {
              dirtyRef.current = false;
            }
          } else {
            // Remote moved ahead — keep local dirty; next save will overwrite after refresh of base.
            // Adopt remote timestamp only if we intentionally force-save next time without expected.
            console.warn(
              `shop_state:${key} remote revision changed; keeping local edits and retrying save`,
            );
            baseUpdatedAtRef.current = result.updatedAt;
            // Force another save of our local snapshot (user edits win for single-tenant shop).
            void saveShopState(key, valueRef.current).then((forced) => {
              if (forced.saved) {
                baseUpdatedAtRef.current = forced.updatedAt;
                dirtyRef.current = false;
              }
            });
          }
        })
        .catch((e) => {
          console.error(`Failed to save ${key}`, e);
        })
        .finally(() => {
          savingRef.current = false;
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
          const row = payload.new as { value?: T; updated_at?: string } | null;
          const next = row?.value;
          if (next === undefined) return;

          // Never discard unsaved local edits.
          if (dirtyRef.current || savingRef.current) return;

          const cur = JSON.stringify(valueRef.current);
          const incoming = JSON.stringify(next);
          if (cur === incoming) {
            if (row?.updated_at) baseUpdatedAtRef.current = row.updated_at;
            return;
          }
          skipSave.current = true;
          if (row?.updated_at) baseUpdatedAtRef.current = row.updated_at;
          setValueState(next);
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [ready, key]);

  return { value, setValue, ready, error };
}
