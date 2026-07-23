import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useShipments } from "@/components/app/shipments-context";
import {
  mergeTitusIntoExisting,
  titusOrderToParsed,
  titusParseToInput,
  titusRowHasChanges,
} from "@/lib/titus-import";
import {
  loadLastTitusSyncAt,
  loadTitusCreds,
  markTitusSyncedNow,
  syncTitusOrders,
} from "@/lib/titus-sync";

const INTERVAL_MS = 15 * 60 * 1000; // 15 min
const MIN_GAP_MS = 2 * 60 * 1000; // skip if synced < 2 min ago

/**
 * Background Titus sync when credentials are saved in this browser.
 * Only mutates local shipment state when something actually changed.
 */
export function useTitusAutoSync(enabled = true) {
  const { shipments, addShipment, updateShipment } = useShipments();
  const shipmentsRef = useRef(shipments);
  shipmentsRef.current = shipments;
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const run = async (quiet: boolean) => {
      const creds = loadTitusCreds();
      if (!creds) return;
      if (running.current) return;

      const last = loadLastTitusSyncAt();
      if (last) {
        const age = Date.now() - new Date(last).getTime();
        if (Number.isFinite(age) && age >= 0 && age < MIN_GAP_MS) return;
      }

      running.current = true;
      try {
        const result = await syncTitusOrders({
          data: { username: creds.username, password: creds.password },
        });
        if (!result.ok) {
          if (!quiet) toast.error(result.error);
          return;
        }

        const list = shipmentsRef.current;
        let added = 0;
        let updated = 0;
        for (const row of result.orders) {
          const p = titusOrderToParsed(row);
          const existing = list.find(
            (s) => (s.trackingNumber ?? "").toUpperCase() === p.trackingNumber,
          );
          if (existing) {
            if (!titusRowHasChanges(existing, p)) continue;
            updateShipment(existing.id, mergeTitusIntoExisting(existing, p));
            updated += 1;
          } else {
            addShipment(titusParseToInput(p));
            added += 1;
          }
        }

        markTitusSyncedNow();
        if (added || updated) {
          toast.success(
            `Titus auto-sync` +
              (added ? ` · ${added} new` : "") +
              (updated ? ` · ${updated} updated` : ""),
          );
        }
      } catch {
        // Quiet fail in background — user can Sync manually
      } finally {
        running.current = false;
      }
    };

    void run(true);
    const id = window.setInterval(() => void run(true), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, addShipment, updateShipment]);
}
