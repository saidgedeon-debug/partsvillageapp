import { useEffect, useState } from "react";
import { Minus, PackagePlus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { useCart, type DocumentKind } from "@/components/app/cart-context";
import { QuickCreateDocumentPartDialog } from "@/components/app/quick-create-document-part-dialog";
import { useDocuments } from "@/components/app/documents-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { currency, type Part } from "@/lib/mock-data";
import { lineTotal, lineUnitAmount } from "@/lib/document-export";
import { documentGrandTotal, roundMoney } from "@/lib/document-money";
import { lastClientSalePrice } from "@/lib/part-price-history";

const kindLabel = {
  quotation: "Quotation",
  invoice: "Invoice",
  inquiry: "Inquiry",
  receipt: "Receipt",
  credit_note: "Credit Note",
} as const satisfies Record<DocumentKind, string>;

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
        className="h-11 w-11"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, qty - 1))}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Input
        type="number"
        min={1}
        inputMode="numeric"
        className="h-11 w-16 px-1 text-center text-base font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
        className="h-11 w-11"
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function MoneyField({
  value,
  onChange,
  label,
  promptOverrideReason,
}: {
  value: number;
  onChange: (n: number, reason?: string) => void;
  label: string;
  /** When true, live-type updates draft only; on blur, prompt for reason if price changed. */
  promptOverrideReason?: boolean;
}) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "");

  useEffect(() => {
    setDraft(value > 0 ? String(value) : "");
  }, [value]);

  const commit = (n: number) => {
    if (promptOverrideReason && n !== value) {
      const reason = window.prompt("Price override reason (optional)");
      onChange(n, reason?.trim() || undefined);
    } else {
      onChange(n);
    }
    setDraft(String(n));
  };

  return (
    <div className="flex items-center gap-1.5">
      <Label className="shrink-0 text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        className="h-8 w-24 px-2 font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (promptOverrideReason) return;
          const n = Number.parseFloat(raw);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        onBlur={() => {
          const n = Number.parseFloat(draft);
          if (!Number.isFinite(n) || n < 0) {
            setDraft(value > 0 ? String(value) : "");
            if (promptOverrideReason) {
              if (value !== 0) commit(0);
            } else {
              onChange(0);
            }
            return;
          }
          if (promptOverrideReason) {
            commit(n);
            return;
          }
          onChange(n);
          setDraft(String(n));
        }}
      />
    </div>
  );
}

export function CartSheet() {
  const {
    cartOpen,
    setCartOpen,
    lines,
    documentKind,
    setDocumentKind,
    addPart,
    updateQty,
    updateLinePrice,
    updateLineCost,
    removeLine,
    clearCart,
    itemCount,
    heldCarts,
    holdCart,
    resumeHeldCart,
    convertHeldToQuotation,
    discardHeldCart,
    partyId,
    partyName,
    openCheckout,
  } = useCart();
  const { invoices } = useDocuments();

  const [createPartOpen, setCreatePartOpen] = useState(false);

  const isInquiry = documentKind === "inquiry";
  const canQuickCreate = documentKind !== "inquiry";
  const total = documentKind
    ? documentGrandTotal(roundMoney(lines.reduce((s, l) => s + lineTotal(l, documentKind), 0)))
    : 0;

  const kinds: DocumentKind[] = ["quotation", "invoice", "inquiry"];

  const onQuickCreated = (part: Part, qty: number, mode: "quotation" | "invoice") => {
    if (!documentKind || documentKind === "inquiry") {
      setDocumentKind(mode);
    }
    addPart(part, qty);
    setCartOpen(true);
  };

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-4 sm:max-w-md sm:p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart
            {itemCount > 0 && <Badge variant="secondary">{itemCount}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Cart is saved if you refresh. Change document type anytime, adjust qty and prices,
            then finish.
          </SheetDescription>
        </SheetHeader>

        {canQuickCreate ? (
          <QuickCreateDocumentPartDialog
            open={createPartOpen}
            onOpenChange={setCreatePartOpen}
            mode={
              documentKind === "invoice" || documentKind === "quotation"
                ? documentKind
                : undefined
            }
            onCreated={onQuickCreated}
          />
        ) : null}

        <div className="space-y-1.5 border-b border-border pb-3">
          {documentKind ? (
            <>
              <p className="text-xs font-medium text-muted-foreground">Document type</p>
              <div className="flex flex-wrap gap-1">
                {kinds.map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={documentKind === k ? "default" : "outline"}
                    className="h-8"
                    onClick={() => setDocumentKind(k)}
                  >
                    {kindLabel[k]}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add parts from inventory, or create a new product for a quotation or invoice.
            </p>
          )}
          {canQuickCreate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-8 w-full gap-1.5"
              onClick={() => setCreatePartOpen(true)}
            >
              <PackagePlus className="h-3.5 w-3.5" />
              New product
            </Button>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {lines.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty.</p>
          )}
          {lines.map((line) => {
            const unit = documentKind ? lineUnitAmount(line, documentKind) : line.unitPrice;
            const last =
              !isInquiry && (partyId || partyName)
                ? lastClientSalePrice(line.partId, line.partNumber, invoices, {
                    id: partyId,
                    name: partyName,
                  })
                : undefined;
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
                    {last && Math.abs(last.amount - line.unitPrice) > 0.005 ? (
                      <button
                        type="button"
                        className="mt-1 text-left text-xs font-medium text-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          updateLinePrice(
                            line.partId,
                            last.amount,
                            `Last price for ${partyName || "client"} on ${last.date}`,
                          )
                        }
                      >
                        Use last price {currency(last.amount)} ({last.date})
                      </button>
                    ) : last ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Matches last client price · {last.date}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Remove ${line.partNumber}`}
                    onClick={() => removeLine(line.partId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <QtyField qty={line.qty} onChange={(n) => updateQty(line.partId, n)} />
                  {isInquiry ? (
                    <MoneyField
                      label="Cost"
                      value={line.unitCost}
                      onChange={(n) => updateLineCost(line.partId, n)}
                    />
                  ) : (
                    <MoneyField
                      label="Price"
                      value={line.unitPrice}
                      promptOverrideReason
                      onChange={(n, reason) => updateLinePrice(line.partId, n, reason)}
                    />
                  )}
                  <span className="ml-auto text-sm font-medium">
                    {unit > 0 && documentKind
                      ? currency(lineTotal(line, documentKind))
                      : isInquiry
                        ? "Cost TBD"
                        : "Price TBD"}
                  </span>
                </div>
                {line.priceOverrideReason ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Override: {line.priceOverrideReason}
                  </p>
                ) : null}
              </div>
            );
          })}

          {heldCarts.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Held carts</p>
              {heldCarts.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {h.lines.length} line{h.lines.length === 1 ? "" : "s"}
                      {h.documentKind ? ` · ${kindLabel[h.documentKind]}` : ""}
                      {h.partyName ? ` · ${h.partyName}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => resumeHeldCart(h.id)}
                    >
                      Resume
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7"
                      onClick={() => convertHeldToQuotation(h.id)}
                    >
                      to Quote
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => discardHeldCart(h.id)}
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="gap-2 border-t border-border pt-4 sm:flex-col">
          <div className="flex w-full items-center justify-between text-sm">
            <span className="text-muted-foreground">{isInquiry ? "Cost subtotal" : "Subtotal"}</span>
            <span className="font-semibold">{total > 0 ? currency(total) : "—"}</span>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={lines.length === 0 || !documentKind}
            onClick={() => {
              setCartOpen(false);
              openCheckout({ whatsapp: true });
            }}
          >
            Finish &amp; WhatsApp PDF
          </Button>
          {lines.length > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const label = window.prompt("Hold cart label");
                  if (label == null) return;
                  holdCart(label);
                }}
              >
                Hold cart
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={clearCart}>
                Clear cart
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
