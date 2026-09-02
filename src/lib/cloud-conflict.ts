/** Notify the UI when cloud merge rebases local edits onto a newer remote revision. */

export type CloudConflictEvent = {
  key: string;
  at: number;
};

type Listener = (event: CloudConflictEvent) => void;

const listeners = new Set<Listener>();

export function emitCloudConflict(key: string) {
  const event: CloudConflictEvent = { key, at: Date.now() };
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeCloudConflicts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const MONEY_QTY_KEYS = new Set(["documents", "inventory", "cart", "parties"]);

export function isMoneyOrStockKey(key: string): boolean {
  return MONEY_QTY_KEYS.has(key);
}

export function conflictLabel(key: string): string {
  switch (key) {
    case "documents":
      return "payments / documents";
    case "inventory":
      return "stock quantities";
    case "cart":
      return "open cart";
    case "parties":
      return "clients / suppliers";
    default:
      return key;
  }
}
