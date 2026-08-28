import { fetchShopState, type ShopStateKey } from "@/lib/cloud-store";

const BACKUP_KEYS: ShopStateKey[] = [
  "inventory",
  "parties",
  "documents",
  "fleet",
  "cart",
  "kits",
  "prefs",
  "shipments",
  "share-inbox",
  "pre-orders",
];

export type ShopBackupFile = {
  version: 1;
  exportedAt: string;
  app: "parts-village";
  domains: Partial<Record<ShopStateKey, unknown>>;
};

export async function buildShopBackup(): Promise<ShopBackupFile> {
  const domains: Partial<Record<ShopStateKey, unknown>> = {};
  for (const key of BACKUP_KEYS) {
    try {
      domains[key] = await fetchShopState(key, null);
    } catch {
      domains[key] = null;
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "parts-village",
    domains,
  };
}

export function downloadShopBackup(backup: ShopBackupFile) {
  const stamp = backup.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parts-village-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseShopBackup(raw: string): ShopBackupFile {
  const data = JSON.parse(raw) as ShopBackupFile;
  if (!data || data.app !== "parts-village" || data.version !== 1 || !data.domains) {
    throw new Error("Not a Parts Village backup file");
  }
  return data;
}

export { BACKUP_KEYS };
