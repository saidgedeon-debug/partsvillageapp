import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Eye, Pencil, ShoppingCart } from "lucide-react";

import { InlineNumberCell } from "@/components/app/inline-number-cell";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  currency,
  locationOf,
  oemNumbersOf,
  partDescriptionOf,
  type Part,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  rows: Part[];
  isORings: boolean;
  /** Non-O-ring location column header (Page vs Stand). */
  locationColumnLabel?: string;
  emptyMessage: string;
  partNumbersCell: (part: Part) => ReactNode;
  showCosts?: boolean;
  onView: (part: Part) => void;
  onEdit: (part: Part) => void;
  onAddToCart: (part: Part) => void;
  onPatch: (
    part: Part,
    patch: { quantity?: number; cost?: number; price?: number },
  ) => void;
};

const DESKTOP_ROW_H = 68;
const MOBILE_CARD_H = 148;

export function VirtualInventoryTable({
  rows,
  isORings,
  locationColumnLabel = "Page",
  emptyMessage,
  partNumbersCell,
  showCosts = true,
  onView,
  onEdit,
  onAddToCart,
  onPatch,
}: Props) {
  const isMobile = useIsMobile();
  const parentRef = useRef<HTMLDivElement>(null);
  const rowH = isMobile ? MOBILE_CARD_H : DESKTOP_ROW_H;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowH,
    overscan: isMobile ? 6 : 12,
  });

  const gridClass = isORings
    ? showCosts
      ? "grid grid-cols-[56px_minmax(100px,1.1fr)_72px_72px_minmax(100px,1fr)_72px_72px_72px_minmax(160px,1.2fr)] gap-2"
      : "grid grid-cols-[56px_minmax(100px,1.1fr)_72px_72px_minmax(100px,1fr)_72px_72px_minmax(160px,1.2fr)] gap-2"
    : showCosts
      ? "grid grid-cols-[52px_minmax(90px,0.9fr)_minmax(120px,1.4fr)_minmax(100px,1fr)_minmax(110px,1.1fr)_56px_minmax(90px,1fr)_64px_72px_72px_minmax(150px,1.1fr)] gap-2"
      : "grid grid-cols-[52px_minmax(90px,0.9fr)_minmax(120px,1.4fr)_minmax(100px,1fr)_minmax(110px,1.1fr)_56px_minmax(90px,1fr)_64px_72px_minmax(150px,1.1fr)] gap-2";

  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  if (isMobile) {
    return (
      <div
        ref={parentRef}
        className="max-h-[min(72dvh,820px)] overflow-auto overscroll-contain pr-0.5"
      >
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const p = rows[vRow.index];
            const low = p.quantity > 0 && p.quantity <= p.reorderAt;
            const description = partDescriptionOf(p);
            return (
              <div
                key={p.id}
                className="absolute left-0 w-full px-0.5"
                style={{
                  height: `${vRow.size}px`,
                  transform: `translateY(${vRow.start}px)`,
                }}
              >
                <article className="flex h-[140px] flex-col justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() => onView(p)}
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg border border-border bg-muted/30 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
                        {isORings ? p.boxNumber ?? "—" : "—"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm font-bold leading-tight">{p.partNumber}</p>
                        {low ? (
                          <Badge variant="destructive" className="shrink-0 gap-1 text-[10px]">
                            <AlertTriangle className="h-3 w-3" />
                            Low
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                        {description || p.name || "—"}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {p.price > 0 ? currency(p.price) : "No price"}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · qty {p.quantity}
                        </span>
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <InlineNumberCell
                        value={p.quantity}
                        ariaLabel={`Edit quantity for ${p.partNumber}`}
                        className={cn(
                          "h-11 w-full justify-center text-base",
                          low && "font-semibold text-accent",
                        )}
                        onCommit={(n) => onPatch(p, { quantity: n })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 shrink-0 gap-1.5 px-3"
                      onClick={() => onEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      className="h-11 shrink-0 gap-1.5 px-3"
                      onClick={() => onAddToCart(p)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Cart
                    </Button>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="max-h-[min(70vh,720px)] overflow-auto">
      <div className="min-w-max">
        <div
          className={cn(
            gridClass,
            "sticky top-0 z-10 border-b border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground",
          )}
        >
          {isORings ? (
            <>
              <span>Box</span>
              <span>Part #</span>
              <span>ID</span>
              <span>CS</span>
              <span>Category</span>
              <span className="text-right">Qty</span>
              {showCosts ? <span className="text-right">Cost</span> : null}
              <span className="text-right">Price</span>
              <span className="text-right">Actions</span>
            </>
          ) : (
            <>
              <span>Photo</span>
              <span>Code</span>
              <span>Description</span>
              <span>OEM</span>
              <span>Machine</span>
              <span>{locationColumnLabel}</span>
              <span>Category</span>
              <span className="text-right">Qty</span>
              {showCosts ? <span className="text-right">Cost</span> : null}
              <span className="text-right">Price</span>
              <span className="text-right">Actions</span>
            </>
          )}
        </div>

        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const p = rows[vRow.index];
            const low = p.quantity > 0 && p.quantity <= p.reorderAt;
            const description = partDescriptionOf(p);
            const machine =
              p.compatibility.length > 0
                ? p.compatibility.join(", ")
                : p.name.includes(" — ")
                  ? p.name.split(" — ").slice(1).join(" — ")
                  : "";
            const oems = oemNumbersOf(p);
            const page =
              locationOf(p) ||
              p.notes?.match(/Catalog p\.?\s*([\d,\s]+)/i)?.[1]?.trim() ||
              "";

            return (
              <div
                key={p.id}
                className={cn(
                  gridClass,
                  "absolute left-0 w-full items-center border-b border-border px-3 py-2",
                )}
                style={{
                  height: `${vRow.size}px`,
                  transform: `translateY(${vRow.start}px)`,
                }}
              >
                {isORings ? (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.boxNumber ?? "—"}
                    </span>
                    <div>{partNumbersCell(p)}</div>
                    <span className="font-mono text-xs">{p.insideDiameterMm || "—"}</span>
                    <span className="font-mono text-xs">{p.crossSectionMm || "—"}</span>
                    <Badge variant="secondary" className="w-fit max-w-full truncate">
                      {p.category}
                    </Badge>
                    <div className="flex items-center justify-end gap-0.5">
                      {low && <AlertTriangle className="h-3.5 w-3.5 text-accent" />}
                      <InlineNumberCell
                        value={p.quantity}
                        ariaLabel={`Edit quantity for ${p.partNumber}`}
                        className={cn(low && "font-semibold text-accent")}
                        onCommit={(n) => onPatch(p, { quantity: n })}
                      />
                    </div>
                    {showCosts ? (
                      <InlineNumberCell
                        value={p.cost}
                        decimal
                        ariaLabel={`Edit cost for ${p.partNumber}`}
                        className="text-muted-foreground"
                        onCommit={(n) => onPatch(p, { cost: n })}
                      />
                    ) : null}
                    <InlineNumberCell
                      value={p.price}
                      decimal
                      ariaLabel={`Edit price for ${p.partNumber}`}
                      className="font-semibold"
                      onCommit={(n) => onPatch(p, { price: n })}
                    />
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <RowActions
                        onView={() => onView(p)}
                        onEdit={() => onEdit(p)}
                        onCart={() => onAddToCart(p)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {p.imageUrl ? (
                      <button
                        type="button"
                        className="block overflow-hidden rounded-md border border-border bg-muted/30"
                        onClick={() => onView(p)}
                      >
                        <img
                          src={p.imageUrl}
                          alt={p.partNumber}
                          className="h-10 w-10 object-contain"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
                        —
                      </div>
                    )}
                    <div>{partNumbersCell(p)}</div>
                    <span className="line-clamp-2 text-xs">{description || "—"}</span>
                    <span className="line-clamp-2 font-mono text-xs text-muted-foreground">
                      {oems.length > 0 ? oems.join(" / ") : "—"}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {machine || "—"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{page || "—"}</span>
                    <Badge variant="secondary" className="w-fit max-w-full truncate text-[10px]">
                      {p.category}
                    </Badge>
                    <div className="flex items-center justify-end gap-0.5">
                      {low && <AlertTriangle className="h-3.5 w-3.5 text-accent" />}
                      <InlineNumberCell
                        value={p.quantity}
                        ariaLabel={`Edit quantity for ${p.partNumber}`}
                        className={cn(low && "font-semibold text-accent")}
                        onCommit={(n) => onPatch(p, { quantity: n })}
                      />
                    </div>
                    {showCosts ? (
                      <InlineNumberCell
                        value={p.cost}
                        decimal
                        ariaLabel={`Edit cost for ${p.partNumber}`}
                        className="text-muted-foreground"
                        onCommit={(n) => onPatch(p, { cost: n })}
                      />
                    ) : null}
                    <InlineNumberCell
                      value={p.price}
                      decimal
                      ariaLabel={`Edit price for ${p.partNumber}`}
                      className="font-semibold"
                      onCommit={(n) => onPatch(p, { price: n })}
                    />
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <RowActions
                        onView={() => onView(p)}
                        onEdit={() => onEdit(p)}
                        onCart={() => onAddToCart(p)}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RowActions({
  onView,
  onEdit,
  onCart,
}: {
  onView: () => void;
  onEdit: () => void;
  onCart: () => void;
}) {
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2" onClick={onView}>
        <Eye className="h-3.5 w-3.5" />
        View
      </Button>
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      <Button type="button" size="sm" className="h-8 gap-1 px-2" onClick={onCart}>
        <ShoppingCart className="h-3.5 w-3.5" />
        Cart
      </Button>
    </>
  );
}
