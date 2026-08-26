import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import type { CartLine } from "@/components/app/cart-context";
import { useDocuments, type SavedDocument } from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateDocId } from "@/lib/document-export";
import { roundMoney } from "@/lib/document-money";
import { currency } from "@/lib/mock-data";
import {
  DEFAULT_QUOTATION_CLIENT,
  parseQuotationWorkbook,
  resolveQuotationLines,
  type QuotationImportPreview,
} from "@/lib/quotation-import";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (quotation: SavedDocument) => void;
};

export function QuotationExcelImportDialog({ open, onOpenChange, onImported }: Props) {
  const { parts, addPart, updatePart } = useInventory();
  const { addDocument } = useDocuments();
  const { clients, addClient } = useParties();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<QuotationImportPreview | null>(null);
  const [clientName, setClientName] = useState(DEFAULT_QUOTATION_CLIENT);

  const resolutions = useMemo(
    () => (preview ? resolveQuotationLines(preview, parts) : []),
    [preview, parts],
  );
  const createCount = resolutions.filter((r) => r.status === "create").length;
  const matchCount = resolutions.filter((r) => r.status === "match").length;

  const reset = () => {
    setPreview(null);
    setClientName(DEFAULT_QUOTATION_CLIENT);
    setBusy(false);
    setSubmitting(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const next = parseQuotationWorkbook(buf, file.name);
      if (next.lines.length === 0) {
        toast.error("No quotation lines found in that Excel file");
        setPreview(null);
        return;
      }
      setPreview(next);
      setClientName(next.clientName || DEFAULT_QUOTATION_CLIENT);
    } catch {
      toast.error("Could not read that Excel file");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!preview || submitting) return;
    const name = clientName.trim() || DEFAULT_QUOTATION_CLIENT;
    if (resolutions.length === 0) {
      toast.error("Nothing to import");
      return;
    }

    setSubmitting(true);
    try {
      let client =
        clients.find((c) => c.name.trim().toLowerCase() === name.toLowerCase()) ?? null;
      if (!client) {
        client = addClient({ name, notes: "Created from quotation Excel import" });
      }

      const lines: CartLine[] = [];
      let createdParts = 0;

      for (const row of resolutions) {
        if (row.status === "match") {
          const part = row.part;
          if (row.line.unitPrice > 0 && part.price !== row.line.unitPrice) {
            updatePart(part.id, { price: row.line.unitPrice });
          }
          lines.push({
            partId: part.id,
            partNumber: part.partNumber,
            name: part.name || row.line.name,
            category: part.category,
            boxNumber: part.boxNumber,
            insideDiameterMm: part.insideDiameterMm,
            crossSectionMm: part.crossSectionMm,
            unitPrice: row.line.unitPrice,
            unitCost: part.cost,
            qty: row.line.qty,
          });
          continue;
        }

        const part = addPart({
          partNumber: row.line.partNumber,
          name: row.line.name,
          category: "MISC",
          quantity: 0,
          reorderAt: 0,
          cost: 0,
          price: row.line.unitPrice,
          notes: `Created from quotation Excel${preview.fileName ? ` · ${preview.fileName}` : ""}`,
        });
        createdParts += 1;
        lines.push({
          partId: part.id,
          partNumber: part.partNumber,
          name: part.name,
          category: part.category,
          unitPrice: row.line.unitPrice,
          unitCost: 0,
          qty: row.line.qty,
        });
      }

      const createdAt = new Date();
      const total = roundMoney(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
      const quotation: SavedDocument = {
        id: generateDocId("quotation", createdAt),
        kind: "quotation",
        partyKind: "client",
        partyId: client.id,
        partyName: client.name,
        date: createdAt.toISOString().slice(0, 10),
        createdAt: createdAt.toISOString(),
        total,
        status: "Sent",
        lines,
        internalNote: preview.fileName
          ? `Imported from Excel · ${preview.fileName}`
          : "Imported from Excel",
      };
      addDocument(quotation);

      toast.success(
        `Quotation ${quotation.id} · ${lines.length} lines · ${createdParts} new parts · ${currency(total)}`,
      );
      onOpenChange(false);
      reset();
      onImported?.(quotation);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-muted-foreground" />
            Import quotation Excel
          </DialogTitle>
          <DialogDescription>
            Upload a price list / quotation sheet. Missing client name becomes{" "}
            <span className="font-medium text-foreground">{DEFAULT_QUOTATION_CLIENT}</span>. New
            parts (including Arabic names) are created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="quote-xlsx">Excel file</Label>
            <Input
              id="quote-xlsx"
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={busy || submitting}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {preview ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="quote-client">Client</Label>
                <Input
                  id="quote-client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={DEFAULT_QUOTATION_CLIENT}
                />
                <p className="text-xs text-muted-foreground">
                  {preview.clientNameFromSheet
                    ? "Name found on the sheet — edit if needed."
                    : `No client on sheet → default “${DEFAULT_QUOTATION_CLIENT}”.`}
                </p>
              </div>

              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {preview.fileName || preview.sheetName} · {preview.lines.length} lines ·{" "}
                  {currency(preview.subtotal)}
                </p>
                <p className="text-muted-foreground">
                  {matchCount} existing parts · {createCount} new parts to create
                </p>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
                  {resolutions.slice(0, 40).map((row, i) => (
                    <p key={`${row.line.partNumber}-${i}`}>
                      {row.status === "create" ? "NEW" : "HIT"} · {row.line.partNumber} ·{" "}
                      {row.line.name} · ×{row.line.qty} @ {currency(row.line.unitPrice)}
                    </p>
                  ))}
                  {resolutions.length > 40 ? (
                    <p className="text-muted-foreground">…and {resolutions.length - 40} more</p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!preview || preview.lines.length === 0 || busy || submitting}
            onClick={apply}
          >
            {submitting ? "Importing…" : "Create quotation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
