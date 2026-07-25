/** Device-local role until real auth exists. Not synced to Supabase. */

export type AppRole = "sales" | "warehouse";

const STORAGE_KEY = "parts-village-app-role-v1";

export function readAppRole(): AppRole {
  if (typeof window === "undefined") return "sales";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "warehouse" || raw === "sales") return raw;
  } catch {
    // ignore
  }
  return "sales";
}

export function writeAppRole(role: AppRole) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, role);
  } catch {
    // ignore
  }
}

export function canSeeCosts(role: AppRole): boolean {
  return role === "sales";
}

export function canSeePayments(role: AppRole): boolean {
  return role === "sales";
}
