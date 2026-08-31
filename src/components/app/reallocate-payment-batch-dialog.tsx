import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  invoiceRemaining,
  useDocuments,
  type SavedDocument,
} from "@/components/app/documents-context";
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
import { currency } from "@/lib/mock-data";
import { roundMoney } from "@/lib/document-money";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string | null;
};

export function ReallocatePaymentBatchDialog({ open, onOpenChange, batchId }: Props) {
  const { documents, invoices, creditNotes, reallocatePaymentBatch } = useDocuments();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const batchDocs = useMemo(() => {
    if (!batchId) return [];
    return documents.filter(
      (d) =>
        d.paymentBatchId === batchId &&
        (d.kind === "receipt" || d.kind === "credit_note"),
    );
  }, [documents, batchId]);

  const batchTotal = useMemo(
    () => roundMoney(batchDocs.reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0)),
    [batchDocs],
  );

  const candidateInvoices = useMemo(() => {
    if (!batchDocs[0]) return [];
    const sample = batchDocs[0];
    const nameKey = sample.partyName.trim().toLowerCase();
    const withoutBatchCredits = creditNotes.filter((cn) => cn.paymentBatchId !== batchId);

    // Pretend batch receipts are reversed so room = current rem + this batch's apply on that invoice.
    const batchByInvoice = new Map<string, number>();
    for (const d of batchDocs) {
      if (d.kind !== "receipt" || !d.invoiceId) continue;
      batchByInvoice.set(
        d.invoiceId,
        roundMoney((batchByInvoice.get(d.invoiceId) ?? 0) + d.total),
      );
    }

    return invoices
      .filter((iv) => {
        if (sample.partyId && iv.partyId) return iv.partyId === sample.partyId;
        return iv.partyName.trim().toLowerCase() === nameKey;
      })
      .map((iv) => {
        const rem = invoiceRemaining(iv, creditNotes);
        const fromBatch = batchByInvoice.get(iv.id) ?? 0;
        const room = roundMoney(rem + fromBatch);
        return { invoice: iv, room, fromBatch };
      })
      .filter((row) => row.room > 0.005 || row.fromBatch > 0.005)
      .sort((a, b) => a.invoice.date.localeCompare(b.invoice.date));
  }, [invoices, creditNotes, batchDocs, batchId]);

  useEffect(() => {
    if (!open || !batchId) return;
    const next: Record<string, string> = {};
    for (const row of candidateInvoices) {
      next[row.invoice.id] = row.fromBatch > 0.005 ? String(row.fromBatch) : "";
    }
    // Seed any leftover (was unapplied) onto the oldest open room.
    const allocated = roundMoney(
      Object.values(next).reduce((s, v) => s + (Number(v) || 0), 0),
    );
    let leftover = roundMoney(batchTotal - allocated);
    if (leftover > 0.005) {
      for (const row of candidateInvoices) {
        if (leftover <= 0.005) break;
        const cur = Number(next[row.invoice.id]) || 0;
        const can = roundMoney(row.room - cur);
        if (can <= 0.005) continue;
        const add = Math.min(can, leftover);
        next[row.invoice.id] = String(roundMoney(cur + add));
        leftover = roundMoney(leftover - add);
      }
    }
    setAmounts(next);
    setSubmitting(false);
  }, [open, batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allocTotal = useMemo(
    () =>
      roundMoney(
        Object.values(amounts).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 0), 0),
      ),
    [amounts],
  );

  const submit = () => {
    if (!batchId || submitting) return;
    if (Math.abs(allocTotal - batchTotal) > 0.015) {
      toast.error(`Allocations must total ${currency(batchTotal)}`);
      return;
    }
    try {
      setSubmitting(true);
      const allocations = Object.entries(amounts)
        .map(([invoiceId, raw]) => ({
          invoiceId,
          amount: roundMoney(Number(raw) || 0),
        }))
        .filter((row) => row.amount > 0.005);
      const saved = reallocatePaymentBatch({ batchId, allocations });
      toast.success(`Batch reallocated across ${saved.length} receipt${saved.length === 1 ? "" : "s"}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reallocate batch");
      setSubmitting(false);
    }
  };

  const clientName = batchDocs[0]?.partyName ?? "Client";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reallocate payment batch</DialogTitle>
          <DialogDescription>
            {clientName} · {currency(batchTotal)}
            {batchId ? (
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{batchId}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Move amounts between this client&apos;s invoices. Totals must stay{" "}
            {currency(batchTotal)}.
          </p>
          {candidateInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices available for this client.</p>
          ) : (
            candidateInvoices.map((row) => (
              <div key={row.invoice.id} className="grid grid-cols-[1fr_auto] items-end gap-2">
                <div className="min-w-0 space-y-1">
                  <Label className="font-mono text-xs">{row.invoice.id}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {row.invoice.date} · room {currency(row.room)}
                  </p>
                </div>
                <Input
                  className="w-28"
                  inputMode="decimal"
                  value={amounts[row.invoice.id] ?? ""}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [row.invoice.id]: e.target.value }))
                  }
                />
              </div>
            ))
          )}
          <p
            className={
              Math.abs(allocTotal - batchTotal) > 0.015
                ? "text-sm font-medium text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            Allocated {currency(allocTotal)} / {currency(batchTotal)}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              candidateInvoices.length === 0 ||
              Math.abs(allocTotal - batchTotal) > 0.015
            }
          >
            Save allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Helper for callers that only have a receipt from a batch. */
export function batchIdOf(doc: SavedDocument | null | undefined): string | null {
  return doc?.paymentBatchId?.trim() || null;
}
