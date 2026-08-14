import { useEffect, useMemo, useState } from "react";
import { Percent } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { currency } from "@/lib/mock-data";
import { localTodayIso } from "@/lib/date-local";
import { roundMoney } from "@/lib/document-money";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onRecorded?: (credits: SavedDocument[]) => void;
};

/** Deduct a fixed USD amount from the client's open AR (oldest invoices first). */
export function ClientDiscountDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onRecorded,
}: Props) {
  const { invoices, creditNotes, recordClientDiscount } = useDocuments();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(localTodayIso());
  const [submitting, setSubmitting] = useState(false);

  const openBalance = useMemo(
    () =>
      roundMoney(
        invoices
          .filter((iv) => iv.partyId === clientId)
          .reduce((s, iv) => s + invoiceRemaining(iv, creditNotes), 0),
      ),
    [invoices, creditNotes, clientId],
  );

  useEffect(() => {
    if (!open) return;
    setAmount(openBalance > 0 ? String(openBalance) : "");
    setNote("");
    setDate(localTodayIso());
    setSubmitting(false);
  }, [open, openBalance]);

  const parsed = roundMoney(Number(amount));
  const canSubmit =
    openBalance > 0.005 && Number.isFinite(parsed) && parsed > 0 && parsed - openBalance <= 0.005;

  const submit = () => {
    if (!canSubmit) {
      toast.error(
        openBalance <= 0.005
          ? "No open balance to discount"
          : `Enter an amount up to ${currency(openBalance)}`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const credits = recordClientDiscount({
        clientId,
        clientName,
        amount: parsed,
        date,
        note: note.trim() || undefined,
      });
      const total = roundMoney(credits.reduce((s, c) => s + c.total, 0));
      toast.success(
        `Discount ${currency(total)} applied across ${credits.length} invoice${
          credits.length === 1 ? "" : "s"
        }`,
      );
      onRecorded?.(credits);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply discount");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Account discount
          </DialogTitle>
          <DialogDescription>
            Deduct an amount from {clientName}&apos;s open balance. Applied to the oldest unpaid
            invoices first (same as the statement).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            Open balance: <span className="font-semibold">{currency(openBalance)}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-discount-amount">Discount amount (USD)</Label>
            <Input
              id="client-discount-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-discount-date">Date</Label>
            <Input
              id="client-discount-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-discount-note">Note (optional)</Label>
            <Textarea
              id="client-discount-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Goodwill discount / price adjustment"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || !canSubmit} onClick={submit}>
            {submitting ? "Saving…" : `Deduct ${currency(Number.isFinite(parsed) ? parsed : 0)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
