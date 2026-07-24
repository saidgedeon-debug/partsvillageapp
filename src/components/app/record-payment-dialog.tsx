import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  invoiceAmountPaid,
  invoiceRemaining,
  useDocuments,
  type PaymentMethod,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currency } from "@/lib/mock-data";

const METHODS: PaymentMethod[] = ["OMT", "Whish", "Cash"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected invoice when opened from an invoice row. */
  invoice?: SavedDocument | null;
  onRecorded?: (receipt: SavedDocument) => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentDialog({ open, onOpenChange, invoice, onRecorded }: Props) {
  const { invoices, recordInvoicePayment } = useDocuments();
  const [submitting, setSubmitting] = useState(false);

  const unpaidInvoices = useMemo(
    () =>
      invoices.filter((iv) => invoiceRemaining(iv) > 0.005).sort((a, b) => b.date.localeCompare(a.date)),
    [invoices],
  );

  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [mobile, setMobile] = useState("");
  const [note, setNote] = useState("");

  const selected =
    invoices.find((iv) => iv.id === invoiceId) ??
    unpaidInvoices.find((iv) => iv.id === invoiceId) ??
    null;

  const remaining = selected ? invoiceRemaining(selected) : 0;
  const paid = selected ? invoiceAmountPaid(selected) : 0;
  const needsMobile = method === "OMT" || method === "Whish";

  useEffect(() => {
    if (!open) return;
    const pre = invoice?.id && invoiceRemaining(invoice) > 0 ? invoice.id : "";
    const fallback = unpaidInvoices[0]?.id ?? "";
    const nextId = pre || fallback;
    setInvoiceId(nextId);
    const inv = invoices.find((i) => i.id === nextId);
    setMethod("Cash");
    setPaymentDate(todayIso());
    setMobile("");
    setNote("");
    setAmount(inv ? String(invoiceRemaining(inv)) : "");
    setSubmitting(false);
  }, [open, invoice, unpaidInvoices, invoices]);

  useEffect(() => {
    if (!selected) return;
    setAmount(String(invoiceRemaining(selected)));
  }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset amount when invoice changes

  const submit = () => {
    if (submitting) return;
    try {
      if (!invoiceId) {
        toast.error("Select an invoice");
        return;
      }
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        toast.error("Enter a valid payment amount");
        return;
      }
      if (needsMobile && !mobile.trim()) {
        toast.error("Mobile number is required for OMT and Whish");
        return;
      }
      if (!paymentDate.trim()) {
        toast.error("Payment date is required");
        return;
      }
      setSubmitting(true);
      const receipt = recordInvoicePayment({
        invoiceId,
        amount: value,
        method,
        paymentDate,
        mobile: needsMobile ? mobile.trim() : undefined,
        note: note.trim() || undefined,
      });
      toast.success(`Receipt ${receipt.id} recorded for ${invoiceId}`);
      onOpenChange(false);
      onRecorded?.(receipt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record payment");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Create a receipt for a full or partial payment and link it to an invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="pay-invoice">Invoice</Label>
            <Select value={invoiceId || undefined} onValueChange={setInvoiceId}>
              <SelectTrigger id="pay-invoice">
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {unpaidInvoices.map((iv) => (
                  <SelectItem key={iv.id} value={iv.id}>
                    {iv.id} · {iv.partyName} · {currency(invoiceRemaining(iv))} left
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected ? (
              <p className="text-xs text-muted-foreground">
                Total {currency(selected.total)} · Paid {currency(paid)} · Remaining{" "}
                {currency(remaining)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No open invoice balance to collect.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-method">Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger id="pay-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Date</Label>
            <Input
              id="pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {needsMobile ? (
            <div className="space-y-1.5">
              <Label htmlFor="pay-mobile">Mobile number</Label>
              <Input
                id="pay-mobile"
                type="tel"
                inputMode="tel"
                placeholder="03XX XXX XXX"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="pay-note">Note (optional)</Label>
            <Input
              id="pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Staff note — not shown on PDF title"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!selected || submitting}>
            {submitting ? "Saving…" : "Save receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
