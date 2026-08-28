import { DatabaseBackup } from "lucide-react";
import { useMemo, useState } from "react";

import { BackupDialog } from "@/components/app/backup-dialog";
import { usePrefs } from "@/components/app/prefs-context";
import { Button } from "@/components/ui/button";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Reminds the shop to download a backup if none in the last 7 days. */
export function BackupReminderBanner() {
  const { lastBackupAt } = usePrefs();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const overdue = useMemo(() => {
    if (!lastBackupAt) return true;
    const t = Date.parse(lastBackupAt);
    if (!Number.isFinite(t)) return true;
    return Date.now() - t > WEEK_MS;
  }, [lastBackupAt]);

  if (!overdue || dismissed) return null;

  const days = lastBackupAt
    ? Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86_400_000)
    : null;

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-foreground md:px-6"
      >
        <div className="flex items-start gap-2">
          <DatabaseBackup className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <div>
            <p className="font-medium">Weekly backup reminder</p>
            <p className="text-xs text-muted-foreground">
              {days == null
                ? "No backup downloaded yet. Export a JSON snapshot for peace of mind."
                : `Last backup was ${days} day${days === 1 ? "" : "s"} ago.`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Later
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Backup now
          </Button>
        </div>
      </div>
      <BackupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
