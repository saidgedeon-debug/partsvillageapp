import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { retryCloudSync } from "@/lib/cloud-store";

/** Shows when the browser reports offline / poor connection. */
export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      retryCloudSync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-foreground md:px-6"
    >
      <div className="flex items-start gap-2">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <p className="font-medium">You are offline</p>
          <p className="text-xs text-muted-foreground">
            Working from the last cached shop data. Edits save on this device until you reconnect.
          </p>
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => retryCloudSync()}>
        Retry when online
      </Button>
    </div>
  );
}
