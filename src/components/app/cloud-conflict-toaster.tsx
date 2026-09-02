import { useEffect } from "react";
import { toast } from "sonner";

import {
  conflictLabel,
  isMoneyOrStockKey,
  subscribeCloudConflicts,
} from "@/lib/cloud-conflict";
import { retryCloudSync } from "@/lib/cloud-store";

/** Toasts when cloud merge touches payments, stock, cart, or parties. */
export function CloudConflictToaster() {
  useEffect(() => {
    let lastAt = 0;
    return subscribeCloudConflicts((event) => {
      if (!isMoneyOrStockKey(event.key)) return;
      // Debounce bursts from multi-key merges.
      if (event.at - lastAt < 2500) return;
      lastAt = event.at;
      toast.message(`Cloud updated — review ${conflictLabel(event.key)}`, {
        description: "Another device or tab changed shop data. Your edits were merged.",
        action: {
          label: "Retry sync",
          onClick: () => retryCloudSync(),
        },
        duration: 8_000,
      });
    });
  }, []);

  return null;
}
