import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  invoiceAmountPaid,
  invoiceRemaining,
  receiptAffectsBalance,
  useDocuments,
  type PaymentMethod,
  type SavedDocument,
} from "@/components/app/documents-context";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currency } from "@/lib/mock-data";
import { localTodayIso } from "@/lib/date-local";
import { roundMoney } from "@/lib/document-money";
import { cn } from "@/lib/utils";

const METHODS: PaymentMethod[] = ["OMT", "Whish", "Cash"];

type PayMode = "single" | "account";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected invoice when opened from an invoice row. */
  invoice?: SavedDocument | null;
  /** Existing receipt to edit (opens in edit mode). */
  receipt?: SavedDocument | null;
  /** When set, only show invoices for this client. */
  clientId?: string | null;
  /** Optional client name match for invoices missing partyId. */
  clientName?: string | null;
  onRecorded?: (receipt: SavedDocument) => void;
};

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  receipt,
  clientId,
  clientName,
  onRecorded,
}: Props) {
  const {
    invoices,
    receipts,
    creditNotes,
    recordInvoicePayment,
    recordAccountPayment,
    updateInvoicePayment,
  } = useDocuments();
  const { clients } = useParties();
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(receipt?.id && receipt.kind === "receipt");

  const [mode, setMode] = useState<PayMode>("single");
  const [accountClientId, setAccountClientId] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(localTodayIso());
  const [mobile, setMobile] = useState("");
  const [note, setNote] = useState("");

  const effectiveClientId = clientId || accountClientId || null;
  const effectiveClientName =
    clientName ||
    clients.find((c) => c.id === effectiveClientId)?.name ||
    invoice?.partyName ||
    null;

  const clientInvoices = useMemo(() => {
    if (!effectiveClientId && !effectiveClientName && mode === "account") return [];
    if (!effectiveClientId && !effectiveClientName && !clientId && !clientName) {
      return invoices;
    }
    const nameKey = (effectiveClientName ?? clientName)?.trim().toLowerCase() ?? "";
    const id = effectiveClientId ?? clientId;
    return invoices.filter((iv) => {
      if (id && iv.partyId) return iv.partyId === id;
      if (id && !iv.partyId && nameKey) {
        return iv.partyName.trim().toLowerCase() === nameKey;
      }
      if (!id && nameKey) {
        return iv.partyName.trim().toLowerCase() === nameKey;
      }
      return false;
    });
  }, [invoices, effectiveClientId, effectiveClientName, clientId, clientName, mode]);

  const unpaidInvoices = useMemo(
    () =>
      clientInvoices
        .filter((iv) => invoiceRemaining(iv, creditNotes) > 0.005)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [clientInvoices, creditNotes],
  );

  const paidWithoutReceipt = useMemo(() => {
    const receiptInvoiceIds = new Set(
      receipts.map((r) => r.invoiceId).filter((id): id is string => Boolean(id)),
    );
    return clientInvoices
      .filter(
        (iv) =>
          invoiceRemaining(iv, creditNotes) <= 0.005 && !receiptInvoiceIds.has(iv.id),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [clientInvoices, receipts, creditNotes]);

  const selectableInvoices = useMemo(
    () => [...unpaidInvoices, ...paidWithoutReceipt],
    [unpaidInvoices, paidWithoutReceipt],
  );

  const accountPool = useMemo(() => {
    if (selectedInvoiceIds.length === 0) return unpaidInvoices;
    const set = new Set(selectedInvoiceIds);
    return unpaidInvoices.filter((iv) => set.has(iv.id));
  }, [unpaidInvoices, selectedInvoiceIds]);

  const accountDue = useMemo(
    () => roundMoney(accountPool.reduce((s, iv) => s + invoiceRemaining(iv, creditNotes), 0)),
    [accountPool, creditNotes],
  );

  const allocationPreview = useMemo(() => {
    let left = roundMoney(Number(amount) || 0);
    if (!(left > 0)) return { rows: [] as Array<{ id: string; apply: number; remaining: number }>, unapplied: 0 };
    const rows: Array<{ id: string; apply: number; remaining: number }> = [];
    for (const iv of accountPool) {
      if (left <= 0.005) break;
      const rem = invoiceRemaining(iv, creditNotes);
      const apply = roundMoney(Math.min(rem, left));
      if (apply <= 0.005) continue;
      rows.push({ id: iv.id, apply, remaining: rem });
      left = roundMoney(left - apply);
    }
    return { rows, unapplied: left > 0.005 ? left : 0 };
  }, [amount, accountPool, creditNotes]);

  const selected = clientInvoices.find((iv) => iv.id === invoiceId) ?? null;

  const remaining = useMemo(() => {
    if (!selected) return 0;
    const current = invoiceRemaining(selected, creditNotes);
    if (editing && receipt && receiptAffectsBalance(receipt)) {
      return roundMoney(current + (Number.isFinite(receipt.total) ? receipt.total : 0));
    }
    return current;
  }, [selected, editing, receipt, creditNotes]);

  const paid = selected ? invoiceAmountPaid(selected) : 0;
  const alreadyPaid = Boolean(selected && !editing && remaining <= 0.005);
  const needsMobile = method === "OMT" || method === "Whish";

  const defaultAmountFor = (inv: SavedDocument | undefined) => {
    if (!inv) return "";
    const rem = invoiceRemaining(inv, creditNotes);
    if (rem > 0.005) return String(roundMoney(rem));
    return String(roundMoney(invoiceAmountPaid(inv) || inv.total));
  };

  useEffect(() => {
    if (!open) return;
    if (editing && receipt) {
      setMode("single");
      setInvoiceId(receipt.invoiceId ?? "");
      setMethod(receipt.paymentMethod ?? "Cash");
      setAmount(String(roundMoney(receipt.total)));
      setPaymentDate(receipt.paymentDate || receipt.date || localTodayIso());
      setMobile(receipt.paymentMobile ?? "");
      setNote(receipt.customerNote ?? receipt.internalNote ?? "");
      setSubmitting(false);
      return;
    }
    const preferAccount = !invoice?.id && Boolean(clientId || clientName);
    setMode(preferAccount ? "account" : "single");
    setAccountClientId(clientId ?? "");
    setSelectedInvoiceIds([]);
    const pre =
      invoice?.id && selectableInvoices.some((iv) => iv.id === invoice.id) ? invoice.id : "";
    const fallback = selectableInvoices[0]?.id ?? "";
    const nextId = pre || fallback;
    setInvoiceId(nextId);
    const inv = clientInvoices.find((i) => i.id === nextId);
    setMethod("Cash");
    setPaymentDate(localTodayIso());
    setMobile("");
    setNote("");
    setAmount(
      preferAccount
        ? unpaidInvoices.length
          ? String(
              roundMoney(
                unpaidInvoices.reduce((s, iv) => s + invoiceRemaining(iv, creditNotes), 0),
              ),
            )
          : ""
        : defaultAmountFor(inv),
    );
    setSubmitting(false);
  }, [open, invoice, receipt, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || editing || mode !== "single" || !selected) return;
    setAmount(defaultAmountFor(selected));
    if (alreadyPaid && selected.date) setPaymentDate(selected.date);
  }, [invoiceId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || editing || mode !== "account") return;
    if (accountDue > 0.005) setAmount(String(accountDue));
  }, [mode, effectiveClientId, selectedInvoiceIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = () => {
    if (submitting) return;
    try {
      const value = roundMoney(Number(amount));
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
      const payload = {
        amount: value,
        method,
        paymentDate,
        mobile: needsMobile ? mobile.trim() : undefined,
        note: note.trim() || undefined,
      };

      if (editing && receipt) {
        if (!invoiceId) {
          toast.error("Select an invoice");
          setSubmitting(false);
          return;
        }
        const saved = updateInvoicePayment({ receiptId: receipt.id, ...payload });
        toast.success(`Receipt ${saved.id} updated`);
        onOpenChange(false);
        onRecorded?.(saved);
        return;
      }

      if (mode === "account") {
        const name =
          effectiveClientName?.trim() ||
          clients.find((c) => c.id === effectiveClientId)?.name ||
          "";
        if (!name) {
          toast.error("Select a client");
          setSubmitting(false);
          return;
        }
        const saved = recordAccountPayment({
          clientId: effectiveClientId || undefined,
          clientName: name,
          ...payload,
          invoiceIds: selectedInvoiceIds.length ? selectedInvoiceIds : undefined,
        });
        const receiptCount = saved.filter((d) => d.kind === "receipt").length;
        const creditCount = saved.filter((d) => d.kind === "credit_note").length;
        if (receiptCount && creditCount) {
          toast.success(
            `Applied to ${receiptCount} invoice${receiptCount === 1 ? "" : "s"}; ${currency(saved.filter((d) => d.kind === "credit_note").reduce((s, d) => s + d.total, 0))} parked as unapplied credit`,
          );
        } else if (creditCount && !receiptCount) {
          toast.success(`Parked ${currency(value)} as unapplied on-account credit`);
        } else {
          toast.success(
            receiptCount === 1
              ? `Receipt ${saved[0]!.id} recorded`
              : `Payment applied to ${receiptCount} invoices (${currency(value)})`,
          );
        }
        onOpenChange(false);
        const firstReceipt = saved.find((d) => d.kind === "receipt");
        if (firstReceipt) onRecorded?.(firstReceipt);
        return;
      }

      if (!invoiceId) {
        toast.error("Select an invoice");
        setSubmitting(false);
        return;
      }
      const saved = recordInvoicePayment({ invoiceId, ...payload });
      toast.success(`Receipt ${saved.id} recorded for ${invoiceId}`);
      onOpenChange(false);
      onRecorded?.(saved);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : editing
            ? "Could not update payment"
            : "Could not record payment",
      );
      setSubmitting(false);
    }
  };

  const canSubmit = editing
    ? Boolean(invoiceId)
    : mode === "account"
      ? Boolean(effectiveClientName || effectiveClientId)
      : Boolean(selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Edit payment"
              : alreadyPaid && mode === "single"
                ? "Create receipt"
                : "Record payment"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update amount, method, date, or note. Invoice balance adjusts when this receipt affects AR."
              : mode === "account"
                ? "Payment on account — applied to open invoices oldest first (or only the ones you tick)."
                : alreadyPaid
                  ? "This invoice is already paid — create a receipt for your records without changing the balance."
                  : "Create a receipt for a full or partial payment and link it to an invoice."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          {!editing ? (
            <div className="flex rounded-md border border-border p-0.5">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-sm px-2 py-1.5 text-xs font-medium",
                  mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
                onClick={() => setMode("single")}
              >
                One invoice
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-sm px-2 py-1.5 text-xs font-medium",
                  mode === "account" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
                onClick={() => setMode("account")}
              >
                On account / multi
              </button>
            </div>
          ) : null}

          {mode === "account" && !editing ? (
            <>
              {!clientId ? (
                <div className="space-y-1.5">
                  <Label>Client</Label>
                  <Select
                    value={accountClientId || undefined}
                    onValueChange={(v) => {
                      setAccountClientId(v);
                      setSelectedInvoiceIds([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm font-medium">{effectiveClientName}</p>
              )}

              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                Open balance{" "}
                <span className="font-semibold">{currency(accountDue)}</span>
                {selectedInvoiceIds.length > 0
                  ? ` · ${selectedInvoiceIds.length} invoice${selectedInvoiceIds.length === 1 ? "" : "s"} selected`
                  : unpaidInvoices.length
                    ? ` · ${unpaidInvoices.length} open invoice${unpaidInvoices.length === 1 ? "" : "s"}`
                    : ""}
              </div>

              {unpaidInvoices.length > 0 ? (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  <p className="mb-1 text-xs text-muted-foreground">
                    Tick invoices to limit the payment (leave all unchecked = apply to every open
                    invoice, oldest first).
                  </p>
                  {unpaidInvoices.map((iv) => {
                    const rem = invoiceRemaining(iv, creditNotes);
                    const checked =
                      selectedInvoiceIds.length === 0 || selectedInvoiceIds.includes(iv.id);
                    return (
                      <label
                        key={iv.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={
                            selectedInvoiceIds.length === 0
                              ? false
                              : selectedInvoiceIds.includes(iv.id)
                          }
                          onChange={() => toggleInvoice(iv.id)}
                        />
                        <span className={cn("min-w-0 flex-1 font-mono text-xs", !checked && selectedInvoiceIds.length ? "opacity-40" : "")}>
                          {iv.id}
                        </span>
                        <span className="text-xs text-muted-foreground">{iv.date}</span>
                        <span className="font-semibold">{currency(rem)}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No open invoices for this client.</p>
              )}

              {allocationPreview.rows.length > 0 || allocationPreview.unapplied > 0.005 ? (
                <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Will apply as:</p>
                  {allocationPreview.rows.map((row) => (
                    <p key={row.id}>
                      {row.id} · {currency(row.apply)}
                      {row.apply + 0.005 < row.remaining ? " (partial)" : ""}
                    </p>
                  ))}
                  {allocationPreview.unapplied > 0.005 ? (
                    <p className="text-foreground">
                      Unapplied credit · {currency(allocationPreview.unapplied)} (parked on account)
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="pay-invoice">Invoice</Label>
              {editing ? (
                <>
                  <Input id="pay-invoice" value={invoiceId} disabled readOnly />
                  {selected ? (
                    <p className="text-xs text-muted-foreground">
                      Total {currency(selected.total)} · Paid {currency(paid)} · Room for this
                      receipt {currency(remaining)}
                      {receipt && !receiptAffectsBalance(receipt)
                        ? " · record only (balance unchanged)"
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Linked invoice missing.</p>
                  )}
                </>
              ) : (
                <>
                  <Select value={invoiceId || undefined} onValueChange={setInvoiceId}>
                    <SelectTrigger id="pay-invoice">
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {unpaidInvoices.length > 0
                        ? unpaidInvoices.map((iv) => (
                            <SelectItem key={iv.id} value={iv.id}>
                              {iv.id} · {iv.partyName} ·{" "}
                              {currency(invoiceRemaining(iv, creditNotes))} left
                            </SelectItem>
                          ))
                        : null}
                      {paidWithoutReceipt.map((iv) => (
                        <SelectItem key={iv.id} value={iv.id}>
                          {iv.id} · {iv.partyName} · Paid · make receipt
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected ? (
                    <p className="text-xs text-muted-foreground">
                      Total {currency(selected.total)} · Paid {currency(paid)} · Remaining{" "}
                      {currency(remaining)}
                      {alreadyPaid ? " · receipt for record only" : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {clientId
                        ? "No open invoices for this client."
                        : "No invoices available — open balances or paid invoices without a receipt."}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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
            {mode === "account" && !editing && accountDue > 0.005 ? (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setAmount(String(accountDue))}
              >
                Use full open balance ({currency(accountDue)})
              </button>
            ) : null}
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
            <Label htmlFor="pay-note">Note on receipt (optional)</Label>
            <Input
              id="pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Printed on the receipt PDF…"
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
          <Button type="button" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting
              ? "Saving…"
              : editing
                ? "Save changes"
                : mode === "account"
                  ? "Apply payment"
                  : alreadyPaid
                    ? "Create receipt"
                    : "Save receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
