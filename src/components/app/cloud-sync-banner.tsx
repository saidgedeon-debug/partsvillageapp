import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCloudError, useCloudHealth, retryCloudSync } from "@/lib/cloud-store";

/** Persistent banner when cloud sync fails; retry reloads shop_state hooks. */
export function CloudSyncBanner() {
  const health = useCloudHealth();
  const error = useCloudError();

  if (health !== "error" && !error) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-foreground md:px-6"
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="font-medium">Cloud sync issue</p>
          <p className="text-xs text-muted-foreground">
            {error ||
              "Could not reach Supabase. Local edits may not be saved until you retry."}
          </p>
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={retryCloudSync}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry sync
      </Button>
    </div>
  );
}
