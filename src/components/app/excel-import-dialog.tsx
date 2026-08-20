import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import {
  buildInventoryImportPreview,
  guessInventoryMapping,
  readInventoryWorkbook,
  type InventoryImportMapping,
} from "@/lib/inventory-import";
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
  const { parts, bulkUpdateParts, addPart } = useInventory();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<InventoryImportMapping>({
    partNumber: "",
    name: "",
    category: "",
    quantity: "",
    cost: "",
    price: "",
    reorderAt: "",
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = readInventoryWorkbook(buf);
      setHeaders(workbook.headers);
      setRows(workbook.rows);
      setMapping(guessInventoryMapping(workbook.headers));
    } catch {
      toast.error("Could not read that Excel file");
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(
    () => (mapping.partNumber ? buildInventoryImportPreview(rows, mapping, parts) : []),
    [rows, mapping, parts],
  );
  const updates = preview.filter((row) => row.action === "update");
  const creates = preview.filter((row) => row.action === "create");
  const skips = preview.filter((row) => row.action === "skip");

  const applyImport = () => {
    const bigDrops = updates.filter((row) => {
      if (row.action !== "update" || !row.before || !row.after) return false;
      const qtyDrop =
        row.before.quantity != null &&
        row.before.quantity > 0 &&
        row.update.quantity != null &&
        row.update.quantity < row.before.quantity * 0.5;
      const costDrop =
        row.before.cost != null &&
        row.before.cost > 0 &&
        row.update.cost != null &&
        row.update.cost < row.before.cost * 0.5;
      return Boolean(qtyDrop || costDrop);
    });
    if (bigDrops.length > 0) {
      const sample = bigDrops
        .slice(0, 5)
        .map((row) => row.code)
        .join(", ");
      const ok = window.confirm(
        `${bigDrops.length} update(s) drop quantity or cost by more than 50% (${sample}${bigDrops.length > 5 ? "…" : ""}).\n\nApply anyway?`,
      );
      if (!ok) return;
    }

    const updated = bulkUpdateParts(updates.map((row) => row.update));
    let created = 0;
    for (const row of creates) {
      addPart(row.part);
      created += 1;
    }
    toast.success(
      `Import complete: ${updated} updated · ${created} created · ${skips.length} skipped`,
    );
    onOpenChange(false);
    setFileName("");
    setHeaders([]);
    setRows([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Upload Excel
          </DialogTitle>
          <DialogDescription>
            Upload, map columns, review the dry run, then update existing parts and create new ones.
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
            Step 1: choose a file. Step 2: confirm column mapping. Step 3: review and apply.
          </p>
          {headers.length ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["partNumber", "Part number *"],
                    ["name", "Name / description"],
                    ["category", "Category"],
                    ["quantity", "Quantity"],
                    ["cost", "Cost"],
                    ["price", "Price"],
                    ["reorderAt", "Reorder at"],
                  ] as Array<[keyof InventoryImportMapping, string]>
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2"
                      value={mapping[key]}
                      onChange={(event) =>
                        setMapping((current) => ({ ...current, [key]: event.target.value }))
                      }
                    >
                      <option value="">Not mapped</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Dry run</p>
                <p className="text-muted-foreground">
                  {updates.length} updates · {creates.length} new parts · {skips.length} skipped
                </p>
                <div className="mt-2 max-h-40 overflow-y-auto font-mono text-xs">
                  {preview.slice(0, 30).map((row, index) => (
                    <p key={`${row.code}-${index}`}>
                      {row.action.toUpperCase()} · {row.code || "—"} ·{" "}
                      {row.name || ("reason" in row ? row.reason : "")}
                      {row.action === "update" && row.before && row.after
                        ? ` · qty ${row.before.quantity}→${row.after.quantity} · cost ${row.before.cost}→${row.after.cost} · price ${row.before.price}→${row.after.price}`
                        : ""}
                    </p>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!mapping.partNumber || preview.length === 0 || busy}
            onClick={applyImport}
          >
            Apply import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
