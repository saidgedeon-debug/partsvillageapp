import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  documentDiscountAmount,
  documentGrandTotal,
  documentNetSubtotal,
  type DocumentDiscountType,
} from "@/lib/document-money";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  subtotal: number;
  discountType: DocumentDiscountType;
  discountValue: number;
  onTypeChange: (type: DocumentDiscountType) => void;
  onValueChange: (value: number) => void;
  className?: string;
};

/** Percent or fixed-amount discount controls + live total breakdown. */
export function DocumentDiscountControls({
  subtotal,
  discountType,
  discountValue,
  onTypeChange,
  onValueChange,
  className,
}: Props) {
  const discount = discountValue > 0 ? { type: discountType, value: discountValue } : null;
  const off = documentDiscountAmount(subtotal, discount);
  const net = documentNetSubtotal(subtotal, discount);
  const total = documentGrandTotal(subtotal, discount);

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>Discount</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={discountType === "percent" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => onTypeChange("percent")}
          >
            %
          </Button>
          <Button
            type="button"
            size="sm"
            variant={discountType === "amount" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => onTypeChange("amount")}
          >
            $
          </Button>
        </div>
      </div>
      <Input
        type="number"
        min={0}
        max={discountType === "percent" ? 100 : undefined}
        step={discountType === "percent" ? 1 : 0.01}
        value={discountValue || ""}
        placeholder={discountType === "percent" ? "0 %" : "0.00"}
        onChange={(e) => {
          const n = Number(e.target.value);
          onValueChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
        className="h-9 font-mono"
        aria-label={discountType === "percent" ? "Discount percent" : "Discount amount"}
      />
      <div className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex justify-between gap-2 text-muted-foreground">
          <span>Subtotal</span>
          <span className="font-mono">{currency(subtotal)}</span>
        </div>
        {off > 0 ? (
          <div className="flex justify-between gap-2 text-muted-foreground">
            <span>
              Discount
              {discountType === "percent" ? ` (${discountValue}%)` : ""}
            </span>
            <span className="font-mono">−{currency(off)}</span>
          </div>
        ) : null}
        {off > 0 && net !== total ? (
          <div className="flex justify-between gap-2 text-muted-foreground">
            <span>After discount</span>
            <span className="font-mono">{currency(net)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 border-t border-border pt-1 font-semibold text-foreground">
          <span>Total</span>
          <span className="font-mono">{currency(total)}</span>
        </div>
      </div>
    </section>
  );
}
