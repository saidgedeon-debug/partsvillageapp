import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { confirmAction } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveShopState, retryCloudSync } from "@/lib/cloud-store";
import {
  BACKUP_KEYS,
  buildShopBackup,
  downloadShopBackup,
  parseShopBackup,
} from "@/lib/shop-backup";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BackupDialog({ open, onOpenChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const backup = await buildShopBackup();
      downloadShopBackup(backup);
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const raw = await file.text();
      const backup = parseShopBackup(raw);
      const keys = BACKUP_KEYS.filter((k) => backup.domains[k] != null);
      const ok = await confirmAction({
        title: "Restore this backup?",
        description: `This overwrites live cloud data for ${keys.length} domain${keys.length === 1 ? "" : "s"} (inventory, documents, clients, etc.). Download a fresh backup first if you are unsure.`,
        confirmLabel: "Restore",
        destructive: true,
      });
      if (!ok) return;
      for (const key of keys) {
        await saveShopState(key, backup.domains[key]);
      }
      toast.success("Backup restored — reloading data");
      onOpenChange(false);
      retryCloudSync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Backup &amp; restore</DialogTitle>
          <DialogDescription>
            Download a full JSON snapshot of shop data, or restore from a previous backup.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={busy}
            onClick={() => void exportBackup()}
          >
            <Download className="h-4 w-4" />
            Download backup
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void restoreBackup(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Restore from file…
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
