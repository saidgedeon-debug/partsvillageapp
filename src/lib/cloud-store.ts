import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

import { emitCloudConflict } from "@/lib/cloud-conflict";
import { mergeShopStateValue } from "@/lib/shop-state-merge";
import { parseShopStateValue } from "@/lib/shop-state-schema";
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
  | "share-inbox"
  | "pre-orders";

const MIGRATE_FLAG = "parts-village-cloud-migrated-v1";

export type CloudHealthStatus = "loading" | "syncing" | "synced" | "error";
const healthByKey = new Map<ShopStateKey, CloudHealthStatus>();
const healthListeners = new Set<() => void>();
let healthVersion = 0;
let lastCloudError: string | null = null;
const retryListeners = new Set<() => void>();
let retryToken = 0;
const pendingByKey = new Map<ShopStateKey, boolean>();
let pendingVersion = 0;
const pendingListeners = new Set<() => void>();

function setCloudHealth(key: ShopStateKey, status: CloudHealthStatus) {
  if (healthByKey.get(key) === status) return;
  healthByKey.set(key, status);
  healthVersion += 1;
  healthListeners.forEach((listener) => listener());
}

function setPendingKey(key: ShopStateKey, pending: boolean) {
  const prev = pendingByKey.get(key) === true;
  if (prev === pending) return;
  if (pending) pendingByKey.set(key, true);
  else pendingByKey.delete(key);
  pendingVersion += 1;
  pendingListeners.forEach((listener) => listener());
}

function setLastCloudError(message: string | null) {
  if (lastCloudError === message) return;
  lastCloudError = message;
  healthVersion += 1;
  healthListeners.forEach((listener) => listener());
}

export function useCloudHealth(): CloudHealthStatus {
  useSyncExternalStore(
    (listener) => {
      healthListeners.add(listener);
      return () => healthListeners.delete(listener);
    },
    () => healthVersion,
    () => 0,
  );
  const statuses = [...healthByKey.values()];
  if (statuses.includes("error")) return "error";
  if (statuses.includes("syncing")) return "syncing";
  if (statuses.length === 0 || statuses.includes("loading")) return "loading";
  return "synced";
}

/** How many shop_state keys have local edits waiting to sync. */
export function usePendingSyncCount(): number {
  useSyncExternalStore(
    (listener) => {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    },
    () => pendingVersion,
    () => 0,
  );
  return pendingByKey.size;
}

export function useCloudError(): string | null {
  useSyncExternalStore(
    (listener) => {
      healthListeners.add(listener);
      return () => healthListeners.delete(listener);
    },
    () => healthVersion,
    () => 0,
  );
  return lastCloudError;
}

/** Bump retry token so every useCloudState remounts its load effect. */
export function retryCloudSync() {
  setLastCloudError(null);
  for (const key of healthByKey.keys()) {
    setCloudHealth(key, "loading");
  }
  retryToken += 1;
  retryListeners.forEach((listener) => listener());
}

function useCloudRetryToken() {
  return useSyncExternalStore(
    (listener) => {
      retryListeners.add(listener);
      return () => retryListeners.delete(listener);
    },
    () => retryToken,
    () => 0,
  );
}

/** Read a shop_state JSON value from Supabase. */
export async function fetchShopState<T>(key: ShopStateKey, fallback: T): Promise<T> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("shop_state").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (data?.value == null) return fallback;
  const parsed = parseShopStateValue<T>(key, data.value);
  if (!parsed.ok) {
    setLastCloudError(parsed.error);
    return fallback;
  }
  return parsed.value;
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
  const retry = useCloudRetryToken();
  const [value, setValueState] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipSave = useRef(true);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const baseUpdatedAtRef = useRef<string | null>(null);
  /** Last remote value we acknowledged (for 3-way merge on conflict). */
  const baseValueRef = useRef<T>(fallback);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setCloudHealth(key, "loading");
  }, [key, retry]);

  const setValue: Dispatch<SetStateAction<T>> = (action) => {
    setValueState((prev) => {
      const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      if (!skipSave.current) {
        dirtyRef.current = true;
        setPendingKey(key, true);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const msg = "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
      setError(msg);
      setLastCloudError(msg);
      setCloudHealth(key, "error");
      return;
    }

    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        const loaded = await loadOrMigrateShopState(key, localStorageKey, fallback, isEmpty);
        if (cancelled) return;
        const parsed = parseShopStateValue<T>(key, loaded.value);
        const accepted = parsed.ok ? parsed.value : fallback;
        if (!parsed.ok) {
          setError(parsed.error);
          setLastCloudError(parsed.error);
          setCloudHealth(key, "error");
        }
        skipSave.current = true;
        dirtyRef.current = false;
        setPendingKey(key, false);
        baseUpdatedAtRef.current = loaded.updatedAt;
        baseValueRef.current = accepted;
        setValueState(accepted);
        setReady(true);
        if (parsed.ok) {
          setError(null);
          setLastCloudError(null);
          setCloudHealth(key, "synced");
        }
        markCloudMigrated();
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(accepted));
        } catch {
          // ignore quota
        }
      } catch (e) {
        if (cancelled) return;
        // Offline / poor connection: fall back to last cached snapshot so the shop can keep working.
        try {
          const raw = localStorage.getItem(localStorageKey);
          if (raw) {
            const cached = JSON.parse(raw) as T;
            skipSave.current = true;
            dirtyRef.current = false;
            baseUpdatedAtRef.current = null;
            baseValueRef.current = cached;
            setValueState(cached);
            setReady(true);
            const msg =
              (e instanceof Error ? e.message : "Cloud unreachable") +
              " — using offline cache. Changes save locally until sync returns.";
            setError(msg);
            setLastCloudError(msg);
            setCloudHealth(key, "error");
            return;
          }
        } catch {
          // ignore parse errors
        }
        const msg = e instanceof Error ? e.message : "Failed to load cloud data";
        setError(msg);
        setLastCloudError(msg);
        setCloudHealth(key, "error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per key / retry
  }, [key, retry]);

  useEffect(() => {
    if (!ready || !isSupabaseConfigured) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      if (savingRef.current) return;
      savingRef.current = true;
      setCloudHealth(key, "syncing");
      const snapshot = valueRef.current;
      const expected = baseUpdatedAtRef.current;
      void saveShopState(key, snapshot, expected)
        .then((result) => {
          if (result.saved) {
            baseUpdatedAtRef.current = result.updatedAt;
            baseValueRef.current = snapshot;
            // Only clear dirty if nothing newer was typed during the save.
            if (
              valueRef.current === snapshot ||
              JSON.stringify(valueRef.current) === JSON.stringify(snapshot)
            ) {
              dirtyRef.current = false;
              setPendingKey(key, false);
            }
            setError(null);
            setLastCloudError(null);
            setCloudHealth(key, "synced");
            try {
              localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
            } catch {
              // ignore quota
            }
          } else {
            // Remote moved ahead — rebase local edits onto latest remote, then retry.
            console.warn(
              `shop_state:${key} remote revision changed; merging local edits onto remote`,
            );
            void (async () => {
              try {
                const remote = await fetchShopStateRow<T>(key);
                const remoteValue = remote.value ?? fallback;
                const merged = mergeShopStateValue(
                  baseValueRef.current,
                  valueRef.current,
                  remoteValue,
                ) as T;
                baseValueRef.current = remoteValue;
                baseUpdatedAtRef.current = remote.updatedAt;
                skipSave.current = true;
                setValueState(merged);
                dirtyRef.current = true;
                setPendingKey(key, true);
                emitCloudConflict(key);
                const forced = await saveShopState(key, merged, remote.updatedAt);
                if (forced.saved) {
                  baseUpdatedAtRef.current = forced.updatedAt;
                  baseValueRef.current = merged;
                  if (
                    valueRef.current === merged ||
                    JSON.stringify(valueRef.current) === JSON.stringify(merged)
                  ) {
                    dirtyRef.current = false;
                    setPendingKey(key, false);
                  }
                  setError(null);
                  setLastCloudError(null);
                  setCloudHealth(key, "synced");
                } else {
                  // Still racing — leave dirty; next edit/debounce will retry.
                  baseUpdatedAtRef.current = forced.updatedAt;
                  setCloudHealth(key, "syncing");
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : `Failed to save ${key}`;
                setError(msg);
                setLastCloudError(msg);
                setCloudHealth(key, "error");
              }
            })();
          }
        })
        .catch((e) => {
          console.error(`Failed to save ${key}`, e);
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
          } catch {
            // ignore
          }
          const msg =
            (e instanceof Error ? e.message : `Failed to save ${key}`) +
            " — saved offline; will sync when connection returns.";
          setError(msg);
          setLastCloudError(msg);
          setCloudHealth(key, "error");
        })
        .finally(() => {
          savingRef.current = false;
        });
    }, 400);
    return () => window.clearTimeout(t);
  }, [value, ready, key, localStorageKey, fallback]);

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

          if (row?.updated_at) baseUpdatedAtRef.current = row.updated_at;

          // While local edits are in flight, merge remote into local instead of dropping either side.
          if (dirtyRef.current || savingRef.current) {
            const merged = mergeShopStateValue(baseValueRef.current, valueRef.current, next) as T;
            baseValueRef.current = next;
            if (JSON.stringify(merged) === JSON.stringify(valueRef.current)) return;
            // Keep dirty so the debounce save effect uploads the merge (do not skipSave).
            dirtyRef.current = true;
            setValueState(merged);
            emitCloudConflict(key);
            return;
          }

          const cur = JSON.stringify(valueRef.current);
          const incoming = JSON.stringify(next);
          if (cur === incoming) {
            baseValueRef.current = next;
            return;
          }
          skipSave.current = true;
          baseValueRef.current = next;
          setValueState(next);
          emitCloudConflict(key);
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [ready, key]);

  return { value, setValue, ready, error };
}
