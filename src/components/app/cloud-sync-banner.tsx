import { AlertTriangle, CloudUpload, RefreshCw } from "lucide-react";

import { CloudSyncButton } from "@/components/app/cloud-sync-button";
import { Button } from "@/components/ui/button";
import {
  useCloudError,
  useCloudHealth,
  usePendingSyncCount,
  syncNow,
} from "@/lib/cloud-store";

/** Always-visible sync status with a manual Sync button. */
export function CloudSyncBanner() {
  const health = useCloudHealth();
  const error = useCloudError();
  const pending = usePendingSyncCount();
  const problem = health === "error" || Boolean(error);

  return (
    <div
      role={problem ? "alert" : "status"}
      className={
        problem
          ? "flex flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-foreground md:px-6"
          : "flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-1.5 text-sm text-foreground md:px-6"
      }
    >
      <div className="flex min-w-0 items-start gap-2">
        {problem ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="font-medium">
            {problem
              ? `Cloud sync issue${pending > 0 ? ` · ${pending} waiting` : ""}`
              : pending > 0
                ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync`
                : health === "syncing"
                  ? "Syncing with the cloud…"
                  : health === "loading"
                    ? "Loading shop data…"
                    : "Auto-sync on"}
          </p>
          <p className="text-xs text-muted-foreground">
            {error ||
              (pending > 0
                ? "This device still has unsaved work. Tap Sync, then Sync on the other device."
                : "Phone and PC stay in sync. Tap Sync if something is missing.")}
          </p>
        </div>
      </div>
      {problem ? (
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void syncNow()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Sync
        </Button>
      ) : (
        <CloudSyncButton />
      )}
    </div>
  );
}
