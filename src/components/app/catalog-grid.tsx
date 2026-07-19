import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Eye, Package, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currency, partDescriptionOf, type Part } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type BrowseMode = "all" | "machine" | "category";

type Props = {
  parts: Part[];
  searchQuery?: string;
  onView: (part: Part) => void;
  onAddToCart: (part: Part) => void;
};

/** Sort catalog codes gradually from A01 upward (A01-1 → A01-2 → A01-10…). */
export function compareCatalogCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function machineLabel(part: Part): string {
  if (part.compatibility.length > 0) return part.compatibility.join(", ");
  if (part.name.includes(" — ")) return part.name.split(" — ").slice(1).join(" — ");
  return "";
}

function SearchablePick({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-[220px] flex-1 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-full justify-between font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,360px)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      onChange(opt === value ? "" : opt);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const PAGE_SIZE = 60;

export function CatalogGrid({ parts, searchQuery = "", onView, onAddToCart }: Props) {
  const [mode, setMode] = useState<BrowseMode>("all");
  const [machine, setMachine] = useState("");
  const [category, setCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const catalogParts = useMemo(
    () => parts.filter((p) => p.category !== "O-Rings"),
    [parts],
  );

  const machines = useMemo(() => {
    const set = new Set<string>();
    for (const p of catalogParts) {
      for (const m of p.compatibility) {
        const t = m.trim();
        if (t) set.add(t);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [catalogParts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of catalogParts) {
      if (p.category.trim()) set.add(p.category.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [catalogParts]);

  const rows = useMemo(() => {
    let list = catalogParts;
    const q = searchQuery.trim().toLowerCase();

    if (mode === "machine" && machine) {
      list = list.filter((p) =>
        p.compatibility.some((c) => c.trim().toLowerCase() === machine.toLowerCase()),
      );
    }
    if (mode === "category" && category) {
      list = list.filter((p) => p.category.trim().toLowerCase() === category.toLowerCase());
    }

    if (q) {
      list = list.filter((p) => {
        const desc = partDescriptionOf(p).toLowerCase();
        return (
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          desc.includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.compatibility.some((c) => c.toLowerCase().includes(q)) ||
          (p.catalogPage ?? "").toLowerCase().includes(q)
        );
      });
    }

    return [...list].sort((a, b) => compareCatalogCodes(a.partNumber, b.partNumber));
  }, [catalogParts, mode, machine, category, searchQuery]);

  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = visibleCount < rows.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, mode, machine, category]);

  const modes: { id: BrowseMode; label: string }[] = [
    { id: "all", label: "All" },
    { id: "machine", label: "By machine" },
    { id: "category", label: "By category" },
  ];

  const resetVisible = () => setVisibleCount(PAGE_SIZE);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Browse catalog</p>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {modes.map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                variant={mode === m.id ? "default" : "ghost"}
                className="h-8"
                onClick={() => {
                  setMode(m.id);
                  resetVisible();
                }}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>

        {mode === "machine" && (
          <SearchablePick
            label="Machine"
            placeholder="Choose a machine…"
            value={machine}
            options={machines}
            onChange={(next) => {
              setMachine(next);
              resetVisible();
            }}
          />
        )}
        {mode === "category" && (
          <SearchablePick
            label="Category"
            placeholder="Choose a category…"
            value={category}
            options={categories}
            onChange={(next) => {
              setCategory(next);
              resetVisible();
            }}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {rows.length.toLocaleString()} part{rows.length === 1 ? "" : "s"}
        {mode === "machine" && machine ? ` · ${machine}` : ""}
        {mode === "category" && category ? ` · ${category}` : ""}
        {" · "}sorted A01 → up
      </p>

      {mode === "machine" && !machine ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Choose a machine to see its catalog parts.
        </div>
      ) : mode === "category" && !category ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Choose a category to see matching parts.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No catalog parts match.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleRows.map((p) => {
              const description = partDescriptionOf(p);
              const machineText = machineLabel(p);
              const low = p.quantity > 0 && p.quantity <= p.reorderAt;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onView(p)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-accent/50 hover:bg-muted/30"
                >
                  <div className="flex aspect-[4/3] items-center justify-center border-b border-border bg-muted/20">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.partNumber}
                        className="h-full w-full object-contain p-3"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {p.partNumber}
                      </span>
                      {p.catalogPage ? (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          p.{p.catalogPage}
                        </span>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs text-foreground/90">
                      {description || "—"}
                    </p>
                    {machineText ? (
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {machineText}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="secondary" className="max-w-full truncate text-[10px]">
                        {p.category}
                      </Badge>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          low ? "text-accent" : "text-muted-foreground",
                        )}
                      >
                        Qty {p.quantity.toLocaleString()}
                      </span>
                      <span className="ml-auto text-xs font-semibold">
                        {p.price > 0 ? currency(p.price) : "—"}
                      </span>
                    </div>
                    <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1 gap-1"
                        onClick={() => onView(p)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 flex-1 gap-1"
                        onClick={() => onAddToCart(p)}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Cart
                      </Button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Show more ({Math.min(PAGE_SIZE, rows.length - visibleCount)} of{" "}
                {(rows.length - visibleCount).toLocaleString()} left)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
