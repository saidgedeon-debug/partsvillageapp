import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

import { emitCloudConflict } from "@/lib/cloud-conflict";
import { healDocumentsAmountPaid } from "@/lib/document-money-heal";
import { adoptUnsyncedLocalItems, mergeShopStateValue } from "@/lib/shop-state-merge";
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

function healShopStateValue<T>(key: ShopStateKey, value: T): T {
  if (key !== "documents") return value;
  return healDocumentsAmountPaid(value) as T;
}

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

type RegisteredStore = {
  persist: () => Promise<void>;
  pull: (force?: boolean) => Promise<void>;
};

const syncRegistry = new Map<ShopStateKey, RegisteredStore>();

function registerCloudStore(key: ShopStateKey, store: RegisteredStore) {
  syncRegistry.set(key, store);
  return () => {
    if (syncRegistry.get(key) === store) syncRegistry.delete(key);
  };
}

/** Upload local edits, then pull the latest cloud copy on this device. */
export async function syncNow(): Promise<void> {
  setLastCloudError(null);
  const stores = [...syncRegistry.values()];
  if (stores.length === 0) {
    retryToken += 1;
    retryListeners.forEach((listener) => listener());
    return;
  }
  for (const key of healthByKey.keys()) {
    if (healthByKey.get(key) !== "error") setCloudHealth(key, "syncing");
  }
  await Promise.allSettled(stores.map((store) => store.persist()));
  await Promise.allSettled(stores.map((store) => store.pull(true)));
  const stillPending = [...pendingByKey.values()].some(Boolean);
  const hasError = [...healthByKey.values()].includes("error");
  if (!stillPending && !hasError) {
    for (const key of healthByKey.keys()) {
      setCloudHealth(key, "synced");
    }
  }
}

/** @deprecated Use syncNow — remounting drops in-flight phone edits. */
export function retryCloudSync() {
  void syncNow();
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
): Promise<{ value: T; updatedAt: string | null; needsSave?: boolean; cloudValue?: T }> {
  const row = await fetchShopStateRow<T>(key);
  if (row.value != null && !isEmpty(row.value)) {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) {
          const cached = JSON.parse(raw) as T;
          const adopted = adoptUnsyncedLocalItems(row.value, cached) as T;
          if (adopted !== row.value) {
            return {
              value: adopted,
              updatedAt: row.updatedAt,
              needsSave: true,
              cloudValue: row.value,
            };
          }
        }
      } catch {
        // ignore cache parse errors
      }
    }
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
  const pendingRetryRef = useRef(false);
  const savingWaitersRef = useRef<Array<() => void>>([]);
  const readyRef = useRef(false);
  const persistNowRef = useRef<() => Promise<void>>(async () => {});
  const pullRemoteRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const baseUpdatedAtRef = useRef<string | null>(null);
  /** Last remote value we acknowledged (for 3-way merge on conflict). */
  const baseValueRef = useRef<T>(fallback);
  const valueRef = useRef(value);
  valueRef.current = value;
  readyRef.current = ready;

  useEffect(() => {
    setCloudHealth(key, "loading");
  }, [key, retry]);

  const writeCache = (next: T) => {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  };

  const setValue: Dispatch<SetStateAction<T>> = (action) => {
    setValueState((prev) => {
      const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      if (next === prev) return prev;
      if (!skipSave.current) {
        dirtyRef.current = true;
        setPendingKey(key, true);
        writeCache(next);
      }
      return next;
    });
  };

  const mergeFieldKey = key === "documents" ? "documents" : undefined;

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
        const accepted = parsed.ok ? healShopStateValue(key, parsed.value) : fallback;
        if (!parsed.ok) {
          setError(parsed.error);
          setLastCloudError(parsed.error);
          setCloudHealth(key, "error");
        }
        skipSave.current = true;
        dirtyRef.current = Boolean(loaded.needsSave);
        setPendingKey(key, Boolean(loaded.needsSave));
        baseUpdatedAtRef.current = loaded.updatedAt;
        baseValueRef.current = loaded.cloudValue ?? accepted;
        setValueState(accepted);
        setReady(true);
        if (parsed.ok) {
          setError(null);
          setLastCloudError(null);
          setCloudHealth(key, loaded.needsSave ? "syncing" : "synced");
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
            const cached = healShopStateValue(key, JSON.parse(raw) as T);
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

  const persistNow = async () => {
    if (!readyRef.current || !isSupabaseConfigured) return;
    if (savingRef.current) {
      pendingRetryRef.current = true;
      await new Promise<void>((resolve) => {
        savingWaitersRef.current.push(resolve);
      });
      return persistNowRef.current();
    }
    if (!dirtyRef.current && !pendingRetryRef.current) return;

    savingRef.current = true;
    pendingRetryRef.current = false;
    setCloudHealth(key, "syncing");
    let snapshot = valueRef.current;
    let wrote = false;
    writeCache(snapshot);

    try {
      let expected = baseUpdatedAtRef.current;
      if (!expected) {
        const remote = await fetchShopStateRow<T>(key);
        if (remote.updatedAt && remote.value != null) {
          const merged = mergeShopStateValue(
            baseValueRef.current,
            snapshot,
            remote.value,
            mergeFieldKey,
          ) as T;
          baseValueRef.current = remote.value;
          baseUpdatedAtRef.current = remote.updatedAt;
          expected = remote.updatedAt;
          if (JSON.stringify(merged) !== JSON.stringify(snapshot)) {
            skipSave.current = true;
            snapshot = merged;
            setValueState(merged);
            writeCache(merged);
          }
        }
      }

      const result = await saveShopState(key, snapshot, expected);
      if (result.saved) {
        wrote = true;
        baseUpdatedAtRef.current = result.updatedAt;
        baseValueRef.current = snapshot;
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
        writeCache(snapshot);
      } else {
        console.warn(`shop_state:${key} remote revision changed; merging local edits onto remote`);
        const remote = await fetchShopStateRow<T>(key);
        const remoteValue = remote.value ?? fallback;
        const merged = mergeShopStateValue(
          baseValueRef.current,
          valueRef.current,
          remoteValue,
          mergeFieldKey,
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
          wrote = true;
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
          writeCache(merged);
        } else {
          baseUpdatedAtRef.current = forced.updatedAt;
          pendingRetryRef.current = true;
          setCloudHealth(key, "syncing");
        }
      }
    } catch (e) {
      console.error(`Failed to save ${key}`, e);
      writeCache(snapshot);
      const msg =
        (e instanceof Error ? e.message : `Failed to save ${key}`) +
        " — saved offline; will sync when connection returns.";
      setError(msg);
      setLastCloudError(msg);
      setCloudHealth(key, "error");
    } finally {
      savingRef.current = false;
      const waiters = savingWaitersRef.current.splice(0);
      waiters.forEach((resolve) => resolve());
      const retry = pendingRetryRef.current || (wrote && dirtyRef.current);
      if (retry && waiters.length === 0) {
        pendingRetryRef.current = false;
        window.setTimeout(() => {
          void persistNowRef.current();
        }, 50);
      }
    }
  };
  persistNowRef.current = persistNow;

  const applyRemote = (next: T, updatedAt: string | null) => {
    next = healShopStateValue(key, next);
    if (updatedAt) baseUpdatedAtRef.current = updatedAt;
    if (dirtyRef.current || savingRef.current) {
      const merged = mergeShopStateValue(
        baseValueRef.current,
        valueRef.current,
        next,
        mergeFieldKey,
      ) as T;
      baseValueRef.current = next;
      if (JSON.stringify(merged) === JSON.stringify(valueRef.current)) return;
      dirtyRef.current = true;
      setPendingKey(key, true);
      setValueState(merged);
      writeCache(merged);
      emitCloudConflict(key);
      return;
    }
    if (JSON.stringify(valueRef.current) === JSON.stringify(next)) {
      baseValueRef.current = next;
      return;
    }
    skipSave.current = true;
    baseValueRef.current = next;
    setValueState(next);
    writeCache(next);
  };

  const pullRemote = async (force = false) => {
    if (!readyRef.current || !isSupabaseConfigured) return;
    try {
      const remote = await fetchShopStateRow<T>(key);
      if (remote.value == null) return;
      if (
        !force &&
        remote.updatedAt &&
        remote.updatedAt === baseUpdatedAtRef.current &&
        !dirtyRef.current
      ) {
        return;
      }
      const parsed = parseShopStateValue<T>(key, remote.value);
      if (!parsed.ok) return;
      applyRemote(parsed.value, remote.updatedAt);
    } catch {
      // keep local; next focus / retry will try again
    }
  };
  pullRemoteRef.current = pullRemote;

  useEffect(() => {
    return registerCloudStore(key, {
      persist: () => persistNowRef.current(),
      pull: (force) => pullRemoteRef.current(force),
    });
  }, [key]);

  useEffect(() => {
    if (!ready || !isSupabaseConfigured) return;
    if (skipSave.current) {
      skipSave.current = false;
      if (!dirtyRef.current) return;
    }
    const t = window.setTimeout(() => {
      void persistNowRef.current();
    }, key === "documents" ? 150 : 250);
    return () => window.clearTimeout(t);
  }, [value, ready, key]);

  useEffect(() => {
    if (!ready || !isSupabaseConfigured) return;

    const flush = () => {
      if (dirtyRef.current || pendingRetryRef.current) {
        void persistNowRef.current();
      }
    };
    const refresh = () => {
      if (document.visibilityState === "hidden") {
        flush();
        return;
      }
      void pullRemoteRef.current();
      if (dirtyRef.current) void persistNowRef.current();
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pagehide", flush);
    window.addEventListener("freeze", flush);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        if (dirtyRef.current) void persistNowRef.current();
        void pullRemoteRef.current();
      }
    }, 12_000);

    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("freeze", flush);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.clearInterval(poll);
    };
  }, [ready, key]);

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
        () => {
          // Always refetch — large JSON rows are often truncated in realtime payloads.
          void pullRemoteRef.current(true);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void pullRemoteRef.current(status !== "SUBSCRIBED");
        }
      });

    return () => {
      void sb.removeChannel(channel);
    };
    // applyRemote reads refs; resubscribe only when the store key is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  return { value, setValue, ready, error };
}
