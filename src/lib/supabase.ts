import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const ms = href.includes("/storage/v1") ? 90_000 : 45_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  if (init?.signal) {
    if (init.signal.aborted) ctrl.abort();
    else init.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "pv-operator-auth",
      },
      global: { fetch: fetchWithTimeout },
    })
  : null;

/** Throws if Supabase env vars are missing — app is online-only. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      "Supabase is required. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}
