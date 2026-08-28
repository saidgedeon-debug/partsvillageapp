import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import { confirmAction } from "@/components/app/confirm-dialog";
import {
  buildSupplierPricePreview,
  guessSupplierPriceMapping,
  readSupplierPriceWorkbook,
  type SupplierPriceMapping,
} from "@/lib/supplier-price-import";
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

export function SupplierPriceImportDialog({ open, onOpenChange }: Props) {
  const { parts, bulkUpdateParts } = useInventory();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<SupplierPriceMapping>({
    partNumber: "",
    cost: "",
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = readSupplierPriceWorkbook(buf);
      setHeaders(workbook.headers);
      setRows(workbook.rows);
      setMapping(guessSupplierPriceMapping(workbook.headers));
    } catch {
      toast.error("Could not read that Excel file");
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(
    () => (mapping.partNumber ? buildSupplierPricePreview(rows, mapping, parts) : []),
    [rows, mapping, parts],
  );
  const updates = preview.filter((row) => row.action === "update");
  const skips = preview.filter((row) => row.action === "skip");

  const applyImport = async () => {
    if (updates.length === 0) {
      toast.error("Nothing to update");
      return;
    }
    const ok = await confirmAction({
      title: `Update cost on ${updates.length} part${updates.length === 1 ? "" : "s"}?`,
      description:
        "Sell prices stay unchanged. Only supplier cost is updated from this price list.",
      confirmLabel: "Update costs",
    });
    if (!ok) return;

    bulkUpdateParts(
      updates.map((row) => ({
        id: row.partId!,
        cost: row.cost,
      })),
    );
    toast.success(`Updated cost on ${updates.length} part${updates.length === 1 ? "" : "s"}`);
    onOpenChange(false);
    setFileName("");
    setRows([]);
    setHeaders([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Supplier price list
          </DialogTitle>
          <DialogDescription>
            Import an Excel price list to update part <strong>cost</strong> only — sell prices are
            left alone.
          </DialogDescription>
        </DialogHeader>

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
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {fileName || "Choose Excel file"}
        </Button>

        {headers.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["partNumber", "Part / OEM column"],
                ["cost", "Cost column"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={mapping[key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        {preview.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {updates.length} cost update{updates.length === 1 ? "" : "s"} · {skips.length} skipped
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={updates.length === 0} onClick={() => void applyImport()}>
            Apply costs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
