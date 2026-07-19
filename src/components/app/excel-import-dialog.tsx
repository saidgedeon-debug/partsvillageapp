import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import { parseInventoryExcelFile } from "@/lib/inventory-import";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExcelImportDialog({ open, onOpenChange }: Props) {
  const { parts, bulkUpdateParts } = useInventory();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const { updates, matched, skipped } = parseInventoryExcelFile(buf, parts);
      if (matched === 0) {
        toast.error("No matching part codes found in the file");
        return;
      }
      const n = bulkUpdateParts(updates);
      toast.success(
        `Imported ${n} part${n === 1 ? "" : "s"} from Excel${skipped ? ` · ${skipped} rows skipped` : ""}`,
      );
      onOpenChange(false);
      setFileName("");
    } catch {
      toast.error("Could not read that Excel file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Upload Excel
          </DialogTitle>
          <DialogDescription>
            Upload the inventory sheet you downloaded (or any file with Part Code + Qty / Cost /
            Price columns). Matching codes update stock and prices.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <FileUp className="h-4 w-4" />
            {fileName || "Choose Excel / CSV file"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tip: Download Excel first, edit Qty/Cost/Price in Excel, then upload here.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
