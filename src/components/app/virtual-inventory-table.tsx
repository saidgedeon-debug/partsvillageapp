import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Eye, Pencil, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  currency,
  oemNumbersOf,
  partDescriptionOf,
  type Part,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  rows: Part[];
  isORings: boolean;
  emptyMessage: string;
  partNumbersCell: (part: Part) => ReactNode;
  onView: (part: Part) => void;
  onEdit: (part: Part) => void;
  onAddToCart: (part: Part) => void;
};

const ROW_H = 68;

export function VirtualInventoryTable({
  rows,
  isORings,
  emptyMessage,
  partNumbersCell,
  onView,
  onEdit,
  onAddToCart,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const gridClass = isORings
    ? "grid grid-cols-[56px_minmax(100px,1.1fr)_72px_72px_minmax(100px,1fr)_72px_72px_72px_minmax(160px,1.2fr)] gap-2"
    : "grid grid-cols-[52px_minmax(90px,0.9fr)_minmax(120px,1.4fr)_minmax(100px,1fr)_minmax(110px,1.1fr)_56px_minmax(90px,1fr)_64px_72px_72px_minmax(150px,1.1fr)] gap-2";

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</div>
    );
  }

  return (
    <div className="w-full">
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
            <span className="text-right">Cost</span>
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
            <span>Page</span>
            <span>Category</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Cost</span>
            <span className="text-right">Price</span>
            <span className="text-right">Actions</span>
          </>
        )}
      </div>

      <div ref={parentRef} className="max-h-[min(70vh,720px)] overflow-auto">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
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
              p.catalogPage ||
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
                    <span
                      className={cn(
                        "inline-flex items-center justify-end gap-1 font-semibold",
                        low && "text-accent",
                      )}
                    >
                      {low && <AlertTriangle className="h-3.5 w-3.5" />}
                      {p.quantity.toLocaleString()}
                    </span>
                    <span className="text-right text-muted-foreground">
                      {p.cost > 0 ? currency(p.cost) : "—"}
                    </span>
                    <span className="text-right font-semibold">
                      {p.price > 0 ? currency(p.price) : "—"}
                    </span>
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
                    <span className="font-mono text-xs text-muted-foreground">
                      {page || "—"}
                    </span>
                    <Badge variant="secondary" className="w-fit max-w-full truncate text-[10px]">
                      {p.category}
                    </Badge>
                    <span
                      className={cn(
                        "inline-flex items-center justify-end gap-1 font-semibold",
                        low && "text-accent",
                      )}
                    >
                      {low && <AlertTriangle className="h-3.5 w-3.5" />}
                      {p.quantity.toLocaleString()}
                    </span>
                    <span className="text-right text-sm text-muted-foreground">
                      {p.cost > 0 ? currency(p.cost) : "—"}
                    </span>
                    <span className="text-right text-sm font-semibold">
                      {p.price > 0 ? currency(p.price) : "—"}
                    </span>
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
