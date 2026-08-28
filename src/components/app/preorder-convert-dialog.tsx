import { useEffect, useMemo, useState } from "react";
import { FileText, Receipt } from "lucide-react";
import { toast } from "sonner";

import type { CartLine } from "@/components/app/cart-context";
import {
  useDocuments,
  type PaymentMethod,
  type SavedDocument,
} from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateDocId, lineTotal } from "@/lib/document-export";
import { documentGrandTotal, roundMoney } from "@/lib/document-money";
import { currency } from "@/lib/mock-data";
import {
  preOrderIsPaid,
  preOrderRemaining,
  type CustomerPreOrder,
} from "@/lib/preorders";
import {
  computeOversoldByPart,
  confirmOversell,
  lineQtyByPart,
  stockShortagesForQty,
} from "@/lib/stock-sale";

const METHODS: PaymentMethod[] = ["Cash", "OMT", "Whish"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CustomerPreOrder | null;
  /** When true, receipt checkbox starts checked. */
  withReceiptDefault?: boolean;
  onCreated?: (result: { invoice: SavedDocument; receipt?: SavedDocument }) => void;
};

function preOrderLinesToCart(order: CustomerPreOrder): CartLine[] {
  return order.lines.map((line, index) => ({
    partId: line.partId || `po-${order.id}-${index}`,
    partNumber: line.partNumber,
    name: line.name,
    category: "Pre-order",
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    unitCost: Math.max(0, Number(line.unitCost) || 0),
    qty: Math.max(1, Math.round(line.qty) || 1),
  }));
}

export function PreOrderConvertDialog({
  open,
  onOpenChange,
  order,
  withReceiptDefault = false,
  onCreated,
}: Props) {
  const { addInvoiceWithOptionalReceipt } = useDocuments();
  const { adjustPartQuantity, getPart } = useInventory();
  const { addOrder } = useFleet();
  const { clients } = useParties();

  const [withReceipt, setWithReceipt] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [paymentDate, setPaymentDate] = useState("");
  const [mobile, setMobile] = useState("");
  const [deductStock, setDeductStock] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lines = useMemo(() => (order ? preOrderLinesToCart(order) : []), [order]);
  const subtotal = useMemo(
    () => roundMoney(lines.reduce((s, l) => s + lineTotal(l, "invoice"), 0)),
    [lines],
  );
  const invoiceTotal = documentGrandTotal(subtotal);
  const needsMobile = method === "OMT" || method === "Whish";

  useEffect(() => {
    if (!open || !order) return;
    const paid = roundMoney(Number(order.amountPaid) || 0);
    const defaultReceipt =
      paid > 0.005 ? paid : withReceiptDefault ? invoiceTotal : 0;
    setWithReceipt(withReceiptDefault || paid > 0.005);
    setReceiptAmount(defaultReceipt > 0 ? String(defaultReceipt) : String(invoiceTotal));
    setMethod("Cash");
    setPaymentDate(order.orderedAt || new Date().toISOString().slice(0, 10));
    setMobile("");
    setDeductStock(false);
    setSubmitting(false);
  }, [open, order, withReceiptDefault, invoiceTotal]);

  const submit = async () => {
    if (!order || submitting) return;
    if (lines.length === 0) {
      toast.error("Pre-order has no parts");
      return;
    }
    if (!order.clientName.trim()) {
      toast.error("Pre-order has no customer");
      return;
    }

    const receiptValue = roundMoney(Number(receiptAmount) || 0);
    if (withReceipt) {
      if (!(receiptValue > 0)) {
        toast.error("Enter a receipt amount");
        return;
      }
      if (receiptValue - invoiceTotal > 0.005) {
        toast.error(`Receipt cannot exceed invoice total (${currency(invoiceTotal)})`);
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
    }

    setSubmitting(true);
    try {
      const createdAt = new Date();
      const invoiceId = generateDocId("invoice", createdAt);

      let stockDeducted = false;
      let oversoldByPart: Record<string, number> | undefined;
      if (deductStock) {
        const needed = lineQtyByPart(lines);
        if (!(await confirmOversell(stockShortagesForQty(needed, getPart)))) {
          setSubmitting(false);
          return;
        }
        oversoldByPart = computeOversoldByPart(needed, getPart);
        let deducted = 0;
        for (const line of lines) {
          if (!getPart(line.partId)) continue;
          adjustPartQuantity(line.partId, -line.qty);
          deducted += 1;
        }
        stockDeducted = deducted > 0;
      }

      const draftInvoice: SavedDocument = {
        id: invoiceId,
        kind: "invoice",
        partyKind: "client",
        partyId: order.clientId,
        partyName: order.clientName.trim(),
        date: order.orderedAt || createdAt.toISOString().slice(0, 10),
        createdAt: createdAt.toISOString(),
        total: invoiceTotal,
        status: "Unpaid",
        amountPaid: 0,
        lines: [...lines],
        stockDeducted,
        oversoldByPart:
          oversoldByPart && Object.keys(oversoldByPart).length > 0 ? oversoldByPart : undefined,
        internalNote: `From pre-order ${order.id}${order.notes ? ` · ${order.notes}` : ""}`,
      };

      const { invoice, receipt } = addInvoiceWithOptionalReceipt(
        draftInvoice,
        withReceipt
          ? {
              amount: receiptValue,
              method,
              paymentDate: paymentDate || draftInvoice.date,
              mobile: needsMobile ? mobile.trim() : undefined,
              note: `Pre-order ${order.id} payment`,
            }
          : undefined,
      );

      const client =
        (order.clientId && clients.find((c) => c.id === order.clientId)) ||
        clients.find((c) => c.name.toLowerCase() === order.clientName.trim().toLowerCase());
      if (client) {
        addOrder({
          id: `ord-${invoice.id}`,
          clientId: client.id,
          machineId: "",
          date: invoice.date,
          status: receipt && receiptValue >= invoiceTotal - 0.005 ? "Paid" : "Pending",
          documentId: invoice.id,
          lines: lines.map((l) => ({
            partId: l.partId,
            partNumber: l.partNumber,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
          })),
        });
      }

      toast.success(
        receipt
          ? `Invoice ${invoice.id} + receipt ${receipt.id} created`
          : `Invoice ${invoice.id} created` + (stockDeducted ? " · stock updated" : ""),
      );
      onOpenChange(false);
      onCreated?.({ invoice, receipt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create documents");
      setSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create invoice from pre-order</DialogTitle>
          <DialogDescription>
            {order.clientName} · {order.lines.length} part
            {order.lines.length === 1 ? "" : "s"} · selling total {currency(invoiceTotal)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
            <p>
              Deposit on pre-order:{" "}
              <span className="font-semibold">{currency(order.amountPaid || 0)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {preOrderIsPaid(order)
                ? "Fully paid"
                : `Remaining ${currency(preOrderRemaining(order))}`}
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={withReceipt}
              onChange={(e) => setWithReceipt(e.target.checked)}
            />
            <span>
              <span className="font-medium">Also create receipt</span>
              <span className="block text-xs text-muted-foreground">
                For the deposit already collected, or the full total if you were paid in full.
              </span>
            </span>
          </label>

          {withReceipt ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="po-rcpt-amount">Receipt amount</Label>
                <Input
                  id="po-rcpt-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {(order.amountPaid || 0) > 0.005 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setReceiptAmount(String(roundMoney(order.amountPaid)))}
                    >
                      Use deposit {currency(order.amountPaid)}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setReceiptAmount(String(invoiceTotal))}
                  >
                    Full total {currency(invoiceTotal)}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger>
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
                <Label htmlFor="po-rcpt-date">Payment date</Label>
                <Input
                  id="po-rcpt-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              {needsMobile ? (
                <div className="space-y-1.5">
                  <Label htmlFor="po-rcpt-mobile">Mobile number</Label>
                  <Input
                    id="po-rcpt-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="03XX XXX XXX"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={deductStock}
              onChange={(e) => setDeductStock(e.target.checked)}
            />
            <span>
              <span className="font-medium">Deduct stock</span>
              <span className="block text-xs text-muted-foreground">
                Off by default — pre-order parts are often not in inventory yet.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={submit} className="gap-1.5">
            {withReceipt ? (
              <>
                <Receipt className="h-3.5 w-3.5" />
                {submitting ? "Saving…" : "Create invoice + receipt"}
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                {submitting ? "Saving…" : "Create invoice"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
