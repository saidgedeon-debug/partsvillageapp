import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncNow } from "@/lib/cloud-store";
import { cn } from "@/lib/utils";

export function CloudSyncButton({
  className,
  compact = false,
  label = "Sync",
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await syncNow();
      toast.success("Synced — phone and PC now share the same data");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={compact ? "outline" : "secondary"}
      size={compact ? "icon" : "sm"}
      className={cn(compact ? "h-11 w-11 shrink-0 md:h-9 md:w-9" : "gap-1.5", className)}
      disabled={busy}
      onClick={() => void run()}
      aria-label="Sync now"
      title="Upload this device and pull the latest from the cloud"
    >
      <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
      {compact ? null : busy ? "Syncing…" : label}
    </Button>
  );
}
