/** 3-way JSON merge for shop_state blobs (base = last acknowledged remote). */

import { healDocumentsAmountPaid } from "./document-money-heal";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function equalJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function itemId(v: unknown): string | null {
  if (!isPlainObject(v)) return null;
  const id = v.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function arrayHasIds(arr: unknown[]): boolean {
  return arr.length > 0 && arr.every((item) => itemId(item) != null);
}

function mergeKeyedArray(base: unknown[], local: unknown[], remote: unknown[]): unknown[] {
  const baseBy = new Map(base.map((item) => [itemId(item)!, item]));
  const localBy = new Map(local.map((item) => [itemId(item)!, item]));
  const remoteBy = new Map(remote.map((item) => [itemId(item)!, item]));

  const localOnly: unknown[] = [];
  for (const item of local) {
    const id = itemId(item)!;
    if (!baseBy.has(id) && !remoteBy.has(id)) localOnly.push(item);
  }

  const mergedRemote: unknown[] = [];
  const seen = new Set<string>();
  for (const item of remote) {
    const id = itemId(item)!;
    seen.add(id);
    const b = baseBy.get(id);
    const l = localBy.get(id);
    if (l === undefined) {
      if (b !== undefined && equalJson(b, item)) continue;
      mergedRemote.push(item);
      continue;
    }
    mergedRemote.push(mergeShopStateValue(b, l, item));
  }

  for (const item of local) {
    const id = itemId(item)!;
    if (seen.has(id) || localOnly.includes(item)) continue;
    const b = baseBy.get(id);
    if (!remoteBy.has(id)) {
      if (b === undefined || !equalJson(b, item)) mergedRemote.push(item);
    }
  }

  return [...localOnly, ...mergedRemote];
}

function mergePrimitiveArray(base: unknown[], local: unknown[], remote: unknown[]): unknown[] {
  if (equalJson(local, base)) return remote;
  if (equalJson(remote, base)) return local;
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const item of [...local, ...remote]) {
    const k = JSON.stringify(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function mergeObject(
  base: Record<string, unknown> | undefined,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const keys = new Set([
    ...Object.keys(base ?? {}),
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const b = base?.[key];
    const hasL = Object.prototype.hasOwnProperty.call(local, key);
    const hasR = Object.prototype.hasOwnProperty.call(remote, key);
    if (hasL && hasR) {
      out[key] = mergeShopStateValue(b, local[key], remote[key], key);
    } else if (hasL) {
      if (equalJson(local[key], b)) continue;
      out[key] = local[key];
    } else if (hasR) {
      out[key] = remote[key];
    }
  }
  return out;
}

const DELTA_NUMERIC_KEYS = new Set(["quantity", "reorderAt"]);

export function mergeShopStateValue(
  base: unknown,
  local: unknown,
  remote: unknown,
  fieldKey?: string,
): unknown {
  if (equalJson(local, remote)) return local;
  if (equalJson(local, base)) return remote;
  if (equalJson(remote, base)) return local;

  if (Array.isArray(local) && Array.isArray(remote)) {
    const baseArr = Array.isArray(base) ? base : [];
    let merged: unknown[];
    if (arrayHasIds(local) || arrayHasIds(remote) || arrayHasIds(baseArr)) {
      merged = mergeKeyedArray(baseArr, local, remote);
    } else {
      merged = mergePrimitiveArray(baseArr, local, remote);
    }
    if (fieldKey === "documents") return healDocumentsAmountPaid(merged);
    return merged;
  }

  if (isPlainObject(local) && isPlainObject(remote)) {
    const merged = mergeObject(isPlainObject(base) ? base : undefined, local, remote);
    if (Array.isArray(merged.documents)) {
      return healDocumentsAmountPaid(merged);
    }
    return merged;
  }

  if (
    fieldKey != null &&
    DELTA_NUMERIC_KEYS.has(fieldKey) &&
    typeof base === "number" &&
    Number.isFinite(base) &&
    typeof local === "number" &&
    Number.isFinite(local) &&
    typeof remote === "number" &&
    Number.isFinite(remote)
  ) {
    return remote + (local - base);
  }

  // Prefer local on scalar conflict; heal invoice amountPaid when merging documents blobs.
  const preferred = local;
  if (fieldKey === "documents" && Array.isArray(preferred)) {
    return healDocumentsAmountPaid(preferred);
  }
  if (
    fieldKey == null &&
    isPlainObject(preferred) &&
    Array.isArray((preferred as Record<string, unknown>).documents)
  ) {
    return healDocumentsAmountPaid(preferred);
  }
  return preferred;
}
