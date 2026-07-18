import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { useCart } from "@/components/app/cart-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { currency } from "@/lib/mock-data";
import { lineUnitAmount } from "@/lib/document-export";

const kindLabel = {
  quotation: "Quotation",
  invoice: "Invoice",
  inquiry: "Inquiry",
} as const;

function QtyField({
  qty,
  onChange,
}: {
  qty: number;
  onChange: (qty: number) => void;
}) {
  const [draft, setDraft] = useState(String(qty));

  useEffect(() => {
    setDraft(String(qty));
  }, [qty]);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => onChange(Math.max(1, qty - 1))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        type="number"
        min={1}
        inputMode="numeric"
        className="h-8 w-16 px-1 text-center font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = Number.parseInt(raw, 10);
          if (Number.isFinite(n) && n > 0) onChange(n);
        }}
        onBlur={() => {
          const n = Number.parseInt(draft, 10);
          if (!Number.isFinite(n) || n < 1) {
            setDraft(String(qty));
            return;
          }
          onChange(n);
          setDraft(String(n));
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => onChange(qty + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function CartSheet() {
  const {
    cartOpen,
    setCartOpen,
    lines,
    documentKind,
    updateQty,
    removeLine,
    clearCart,
    setCheckoutOpen,
    itemCount,
  } = useCart();

  const isInquiry = documentKind === "inquiry";
  const total = lines.reduce((s, l) => {
    if (!documentKind) return s;
    return s + l.qty * lineUnitAmount(l, documentKind);
  }, 0);

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart
            {itemCount > 0 && <Badge variant="secondary">{itemCount}</Badge>}
          </SheetTitle>
          <SheetDescription>
            {documentKind
              ? `${kindLabel[documentKind]} draft — type or adjust quantities, then finish.`
              : "Add parts from inventory to start a document."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {lines.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty.</p>
          )}
          {lines.map((line) => {
            const unit = documentKind ? lineUnitAmount(line, documentKind) : line.unitPrice;
            return (
              <div key={line.partId} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{line.partNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">{line.name}</p>
                    {(line.insideDiameterMm || line.crossSectionMm) && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        ID {line.insideDiameterMm ?? "—"} · CS {line.crossSectionMm ?? "—"}
                        {line.boxNumber != null ? ` · Box ${line.boxNumber}` : ""}
                      </p>
                    )}
                    {isInquiry && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Supplier cost:{" "}
                        <span className="font-medium text-foreground">
                          {unit > 0 ? currency(unit) : "Not set"}
                        </span>
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeLine(line.partId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <QtyField qty={line.qty} onChange={(n) => updateQty(line.partId, n)} />
                  <span className="text-sm font-medium">
                    {unit > 0 ? currency(line.qty * unit) : isInquiry ? "Cost TBD" : "Price TBD"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <SheetFooter className="gap-2 border-t border-border pt-4 sm:flex-col">
          <div className="flex w-full items-center justify-between text-sm">
            <span className="text-muted-foreground">{isInquiry ? "Cost subtotal" : "Subtotal"}</span>
            <span className="font-semibold">{total > 0 ? currency(total) : "—"}</span>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={lines.length === 0}
            onClick={() => {
              setCartOpen(false);
              setCheckoutOpen(true);
            }}
          >
            Finish — choose client or supplier
          </Button>
          {lines.length > 0 && (
            <Button type="button" variant="ghost" className="w-full" onClick={clearCart}>
              Clear cart
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
