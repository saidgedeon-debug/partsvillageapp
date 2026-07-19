import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Check,
  ChevronsUpDown,
  Eye,
  Package,
  ShoppingCart,
  Star,
} from "lucide-react";

import { usePrefs } from "@/components/app/prefs-context";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildCategoryBrowsePicks,
  buildGroupSubcategories,
  categoriesMatch,
  categoryBelongsToGroup,
  type CategoryBrowsePick,
  type CategoryGroupId,
} from "@/lib/inventory-categories";
import { currency, oemNumbersOf, partDescriptionOf, type Part } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type BrowseMode = "all" | "machine" | "category" | "favorites";

type Props = {
  parts: Part[];
  searchQuery?: string;
  onView: (part: Part) => void;
  onAddToCart: (part: Part) => void;
};

const PAGE_SIZE = 60;

/** Sort catalog codes gradually from A01 upward (A01-1 → A01-2 → A01-10…). */
export function compareCatalogCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function machineLabel(part: Part): string {
  if (part.compatibility.length > 0) return part.compatibility.join(", ");
  if (part.name.includes(" — ")) return part.name.split(" — ").slice(1).join(" — ");
  return "";
}

function pickValue(p: CategoryBrowsePick): string {
  return p.kind === "group" ? `g:${p.id}` : `c:${p.label}`;
}

function parsePick(value: string): {
  groupId: CategoryGroupId | null;
  looseCategory: string;
} {
  if (value.startsWith("g:")) {
    return { groupId: value.slice(2) as CategoryGroupId, looseCategory: "" };
  }
  if (value.startsWith("c:")) {
    return { groupId: null, looseCategory: value.slice(2) };
  }
  return { groupId: null, looseCategory: "" };
}

function SearchablePick({
  label,
  placeholder,
  value,
  options,
  onChange,
  formatOption,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
  formatOption?: (opt: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const visibleOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? options
      : options.filter((o) => {
          const display = (formatOption?.(o) ?? o).toLowerCase();
          return display.includes(q) || o.toLowerCase().includes(q);
        });
    return filtered.slice(0, 80);
  }, [options, search, formatOption]);

  const displayValue = value ? (formatOption?.(value) ?? value) : "";

  return (
    <div className="min-w-[220px] flex-1 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-full justify-between font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {displayValue || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,360px)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {visibleOptions.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      onChange(opt === value ? "" : opt);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{formatOption?.(opt) ?? opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {search.trim() && visibleOptions.length >= 80 ? (
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              Showing top 80 matches — type more to narrow.
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CatalogGrid({ parts, searchQuery = "", onView, onAddToCart }: Props) {
  const {
    favoritePartIds,
    isFavorite,
    toggleFavorite,
    machinePresets,
    addMachinePreset,
    removeMachinePreset,
    favoriteCategoryGroups,
    recentCategoryGroups,
    touchRecentCategoryGroup,
  } = usePrefs();
  const [mode, setMode] = useState<BrowseMode>("all");
  const [machine, setMachine] = useState("");
  const [categoryPick, setCategoryPick] = useState("");
  const [categorySub, setCategorySub] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [oemQuery, setOemQuery] = useState("");
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

  const browsePicks = useMemo(() => {
    const picks = buildCategoryBrowsePicks(catalogParts);
    const fav = new Set(favoriteCategoryGroups);
    const recent = recentCategoryGroups.filter((id) => !fav.has(id));
    const groups = picks.filter((p) => p.kind === "group");
    const loose = picks.filter((p) => p.kind === "category");
    const byId = new Map(
      groups
        .filter((g): g is Extract<CategoryBrowsePick, { kind: "group" }> => g.kind === "group")
        .map((g) => [g.id, g]),
    );
    const orderedGroups: CategoryBrowsePick[] = [
      ...(favoriteCategoryGroups
        .map((id) => byId.get(id))
        .filter(Boolean) as CategoryBrowsePick[]),
      ...(recent.map((id) => byId.get(id)).filter(Boolean) as CategoryBrowsePick[]),
      ...groups.filter(
        (g) => g.kind === "group" && !fav.has(g.id) && !recent.includes(g.id),
      ),
    ];
    return [...orderedGroups, ...loose];
  }, [catalogParts, favoriteCategoryGroups, recentCategoryGroups]);

  const pickOptions = useMemo(() => browsePicks.map(pickValue), [browsePicks]);
  const pickLabelByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of browsePicks) {
      const v = pickValue(p);
      map.set(
        v,
        p.kind === "group"
          ? `${p.label} · group · ${p.count}`
          : `${p.label} · ${p.count}`,
      );
    }
    return map;
  }, [browsePicks]);

  const { groupId: activeGroup, looseCategory } = parsePick(categoryPick);

  const groupSubs = useMemo(
    () => (activeGroup ? buildGroupSubcategories(catalogParts, activeGroup) : []),
    [catalogParts, activeGroup],
  );

  const filteredSubs = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return groupSubs;
    return groupSubs.filter((s) => s.label.toLowerCase().includes(q));
  }, [groupSubs, groupFilter]);

  const rows = useMemo(() => {
    let list = catalogParts;
    const q = searchQuery.trim().toLowerCase();
    const oem = oemQuery.trim().toLowerCase();
    const gf = groupFilter.trim().toLowerCase();

    if (mode === "favorites") {
      const fav = new Set(favoritePartIds);
      list = list.filter((p) => fav.has(p.id));
    }
    if (mode === "machine" && machine) {
      list = list.filter((p) =>
        p.compatibility.some((c) => c.trim().toLowerCase() === machine.toLowerCase()),
      );
    }
    if (mode === "category" && categoryPick) {
      if (activeGroup) {
        list = list.filter((p) => categoryBelongsToGroup(p.category, activeGroup));
        if (categorySub) {
          list = list.filter((p) => categoriesMatch(p.category, categorySub));
        }
        if (gf) {
          list = list.filter(
            (p) =>
              p.category.toLowerCase().includes(gf) ||
              p.partNumber.toLowerCase().includes(gf) ||
              p.name.toLowerCase().includes(gf) ||
              oemNumbersOf(p).some((n) => n.toLowerCase().includes(gf)),
          );
        }
      } else if (looseCategory) {
        list = list.filter((p) => categoriesMatch(p.category, looseCategory));
      }
    }

    if (oem) {
      list = list.filter(
        (p) =>
          oemNumbersOf(p).some((n) => n.toLowerCase().includes(oem)) ||
          p.partNumber.toLowerCase().includes(oem),
      );
    }

    if (q) {
      list = list.filter((p) => {
        const desc = partDescriptionOf(p).toLowerCase();
        const oems = oemNumbersOf(p).join(" ").toLowerCase();
        return (
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          desc.includes(q) ||
          oems.includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.compatibility.some((c) => c.toLowerCase().includes(q)) ||
          (p.catalogPage ?? "").toLowerCase().includes(q)
        );
      });
    }

    return [...list].sort((a, b) => compareCatalogCodes(a.partNumber, b.partNumber));
  }, [
    catalogParts,
    mode,
    machine,
    categoryPick,
    categorySub,
    activeGroup,
    looseCategory,
    groupFilter,
    searchQuery,
    oemQuery,
    favoritePartIds,
  ]);

  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = visibleCount < rows.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, mode, machine, categoryPick, categorySub, oemQuery, groupFilter]);

  const modes: { id: BrowseMode; label: string }[] = [
    { id: "all", label: "All" },
    { id: "machine", label: "By machine" },
    { id: "category", label: "By category" },
    { id: "favorites", label: "Favorites" },
  ];

  const resetVisible = () => setVisibleCount(PAGE_SIZE);

  const categorySummary =
    mode === "category" && categoryPick
      ? activeGroup
        ? `${pickLabelByValue.get(categoryPick)?.split(" · ")[0] ?? activeGroup}${
            categorySub ? ` · ${categorySub}` : ""
          }`
        : looseCategory
      : "";

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
          <div className="flex w-full flex-col gap-2 lg:max-w-md">
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
            {machine && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 self-start"
                onClick={() => addMachinePreset(machine)}
              >
                <Bookmark className="h-3.5 w-3.5" />
                Save machine preset
              </Button>
            )}
            {machinePresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {machinePresets.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={machine === m ? "default" : "secondary"}
                    className="h-7 max-w-full truncate text-xs"
                    onClick={() => {
                      setMachine(m);
                      resetVisible();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      removeMachinePreset(m);
                    }}
                    title="Click to use · right-click to remove"
                  >
                    {m}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
        {mode === "category" && (
          <div className="flex w-full flex-col gap-2 lg:max-w-lg">
            <SearchablePick
              label="Category / group"
              placeholder="Choose Sensors, Switches, …"
              value={categoryPick}
              options={pickOptions}
              formatOption={(v) => pickLabelByValue.get(v) ?? v}
              onChange={(next) => {
                setCategoryPick(next);
                setCategorySub(null);
                setGroupFilter("");
                resetVisible();
                const parsed = parsePick(next);
                if (parsed.groupId) touchRecentCategoryGroup(parsed.groupId);
              }}
            />
            {activeGroup && (
              <>
                <Input
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  placeholder="Search within group…"
                  className="h-9 text-xs"
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={categorySub === null ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => {
                      setCategorySub(null);
                      resetVisible();
                    }}
                  >
                    All
                  </Button>
                  {filteredSubs.map((sub) => (
                    <Button
                      key={sub.label}
                      type="button"
                      size="sm"
                      variant={categorySub === sub.label ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => {
                        setCategorySub(sub.label);
                        resetVisible();
                      }}
                    >
                      {sub.label}
                      <Badge variant="secondary" className="ml-1">
                        {sub.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="max-w-sm space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">OEM / serial search</p>
        <Input
          value={oemQuery}
          onChange={(e) => setOemQuery(e.target.value)}
          placeholder="e.g. 701/80184"
          className="h-9 font-mono text-xs"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {rows.length.toLocaleString()} part{rows.length === 1 ? "" : "s"}
        {mode === "machine" && machine ? ` · ${machine}` : ""}
        {categorySummary ? ` · ${categorySummary}` : ""}
        {" · "}sorted A01 → up
      </p>

      {mode === "machine" && !machine ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Choose a machine to see its catalog parts.
        </div>
      ) : mode === "category" && !categoryPick ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Choose a group (Sensors, Switches, …) or a leftover category.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No parts match these filters.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleRows.map((p) => {
              const fav = isFavorite(p.id);
              const oems = oemNumbersOf(p);
              return (
                <div
                  key={p.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {p.partNumber}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-foreground">
                        {partDescriptionOf(p)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => toggleFavorite(p.id)}
                      aria-label={fav ? "Remove favorite" : "Add favorite"}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                        )}
                      />
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{p.category}</p>
                  {machineLabel(p) ? (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {machineLabel(p)}
                    </p>
                  ) : null}
                  {oems.length > 0 && (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      OEM {oems.slice(0, 2).join(" · ")}
                      {oems.length > 2 ? ` +${oems.length - 2}` : ""}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="text-xs font-medium">{currency(p.price)}</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2"
                        onClick={() => onView(p)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 px-2"
                        onClick={() => onAddToCart(p)}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Cart
                      </Button>
                    </div>
                  </div>
                </div>
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
                <Package className="mr-1.5 h-4 w-4" />
                Show more ({Math.min(PAGE_SIZE, rows.length - visibleCount)} of{" "}
                {rows.length - visibleCount} left)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
