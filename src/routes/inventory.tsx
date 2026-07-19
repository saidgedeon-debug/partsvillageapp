import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpNarrowWide,
  ChevronDown,
  Eye,
  FolderPlus,
  Package,
  Boxes,
  Pencil,
  Plus,
  ShoppingCart,
  TableProperties,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { PartDetailDialog } from "@/components/app/part-detail-dialog";
import { CategoryFormDialog } from "@/components/app/category-form-dialog";
import { CatalogGrid } from "@/components/app/catalog-grid";
import { BulkStockDialog } from "@/components/app/bulk-stock-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  catalogInventoryCategoryId,
  defaultInventoryCategoryId,
} from "@/lib/inventory-categories";
import { currency, oemNumbersOf, partDescriptionOf, partNumbersOf, type Part } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Parts Village" },
      {
        name: "description",
        content: "Stock levels, dimensions, cost and selling price for every part in the catalog.",
      },
    ],
  }),
  component: InventoryPage,
});

type SortMode = "size" | "box";
type DialogMode = "view" | "edit" | "create";

function PartNumbersCell({ part, catalogMode }: { part: Part; catalogMode?: boolean }) {
  // Catalog mode: Part Code column is catalog code only (OEM has its own column).
  if (catalogMode) {
    return <span className="font-mono text-xs font-medium">{part.partNumber}</span>;
  }

  const numbers = partNumbersOf(part);
  const primary = numbers[0] ?? part.partNumber;
  const extra = numbers.length - 1;

  if (extra <= 0) {
    return <span className="font-mono text-xs font-medium">{primary}</span>;
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs font-medium">{primary}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 min-w-6 gap-0 px-1.5 font-mono text-[11px]"
            aria-label={`Show ${extra} more part number${extra === 1 ? "" : "s"}`}
            onClick={(e) => e.stopPropagation()}
          >
            +{extra}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">All part numbers</p>
          <ul className="space-y-1.5">
            {numbers.map((n, i) => (
              <li
                key={`${n}-${i}`}
                className={cn(
                  "font-mono text-xs",
                  i === 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {n}
                {i === 0 ? (
                  <span className="ml-1.5 font-sans text-[10px] font-normal text-muted-foreground">
                    primary
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function parseMm(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Match CS thickness numerically (3 === 3.00) or exact text for non-numeric values. */
function matchesThickness(cs: string | undefined, thickness: string): boolean {
  const t = thickness.trim();
  if (!t) return true;
  const target = Number(t);
  const actual = parseMm(cs);
  if (Number.isFinite(target) && actual != null) {
    return Math.abs(actual - target) < 0.0005;
  }
  return (cs ?? "").trim().toLowerCase() === t.toLowerCase();
}

function sortParts(list: Part[], mode: SortMode): Part[] {
  return [...list].sort((a, b) => {
    if (mode === "box") {
      const boxDiff = (a.boxNumber ?? 9999) - (b.boxNumber ?? 9999);
      if (boxDiff !== 0) return boxDiff;
    }
    const aId = parseMm(a.insideDiameterMm);
    const bId = parseMm(b.insideDiameterMm);
    if (aId != null && bId != null && aId !== bId) return aId - bId;
    if (aId != null && bId == null) return -1;
    if (aId == null && bId != null) return 1;
    const aCs = parseMm(a.crossSectionMm);
    const bCs = parseMm(b.crossSectionMm);
    if (aCs != null && bCs != null && aCs !== bCs) return aCs - bCs;
    return a.partNumber.localeCompare(b.partNumber);
  });
}

function InventoryPage() {
  const { query } = useSearch();
  const { askDocumentForPart } = useCart();
  const { parts, categories } = useInventory();
  const q = query.trim().toLowerCase();
  const [categoryId, setCategoryId] = useState(defaultInventoryCategoryId);
  const [thickness, setThickness] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("size");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activePart, setActivePart] = useState<Part | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>("view");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    label: string;
    description?: string;
  } | null>(null);
  const [scrollToListToken, setScrollToListToken] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const activeCategory =
    categories.find((c) => c.id === categoryId) ?? categories[0];
  const isCatalogMode = categoryId === catalogInventoryCategoryId;
  const isORings = !isCatalogMode && activeCategory?.matchCategory === "O-Rings";

  const countForCategory = (catId: string, matchCategory: string | null) => {
    if (catId === catalogInventoryCategoryId) {
      return parts.filter((p) => p.category !== "O-Rings").length;
    }
    if (!matchCategory) return parts.length;
    return parts.filter((p) => p.category === matchCategory).length;
  };

  const openPart = (part: Part, mode: DialogMode) => {
    setActivePart(part);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const openCreatePart = () => {
    setActivePart(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (cat: {
    id: string;
    label: string;
    description: string;
    matchCategory: string | null;
  }) => {
    if (!cat.matchCategory) return;
    setEditingCategory({
      id: cat.id,
      label: cat.label,
      description: cat.description,
    });
    setCategoryDialogOpen(true);
  };

  const thicknessPicks = useMemo(() => {
    const nums = new Set<number>();
    for (const p of parts) {
      if (p.category !== "O-Rings") continue;
      const n = parseMm(p.crossSectionMm);
      if (n != null) nums.add(n);
    }
    return [...nums].sort((a, b) => a - b);
  }, [parts]);

  const rows = useMemo(() => {
    if (isCatalogMode) return [];

    let list = parts;

    if (activeCategory?.matchCategory) {
      list = list.filter((p) => p.category === activeCategory.matchCategory);
    }

    if (isORings && thickness.trim()) {
      list = list.filter((p) => matchesThickness(p.crossSectionMm, thickness));
    }

    if (q) {
      list = list.filter((p) => {
        const numbers = partNumbersOf(p).join(" ").toLowerCase();
        return (
          numbers.includes(q) ||
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          String(p.boxNumber ?? "").includes(q) ||
          (p.insideDiameterMm ?? "").toLowerCase().includes(q) ||
          (p.crossSectionMm ?? "").toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q) ||
          p.compatibility.some((c) => c.toLowerCase().includes(q))
        );
      });
    }

    return sortParts(list, isORings ? sortMode : "box");
  }, [q, thickness, sortMode, activeCategory, isORings, isCatalogMode, parts]);

  const filterActive = isORings && Boolean(thickness.trim());
  const totalPieces = rows.reduce((s, p) => s + p.quantity, 0);
  const catalogCount = countForCategory(
    categoryId,
    activeCategory?.matchCategory ?? null,
  );

  useEffect(() => {
    if (!scrollToListToken) return;
    const el = listRef.current;
    if (!el) return;
    // Wait a frame so filtered rows render, then scroll to the list / first item.
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [scrollToListToken, categoryId, rows.length]);

  const selectCategory = (catId: string, matchCategory: string | null) => {
    setCategoryId(catId);
    if (matchCategory !== "O-Rings") {
      setThickness("");
      setSearchOpen(false);
    }
    setScrollToListToken((n) => n + 1);
  };

  // Keep dialog part in sync after edits
  const dialogPart = activePart
    ? (parts.find((p) => p.id === activePart.id) ?? activePart)
    : null;

  return (
    <>
      <PageHeader
        title="Stock / Inventory"
        subtitle={
          isCatalogMode
            ? `Catalog grid · ${catalogCount.toLocaleString()} parts · A01 → up`
            : `Add, edit, or cart · ${rows.length} of ${catalogCount} parts`
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => setBulkOpen(true)}
          >
            <TableProperties className="h-4 w-4" />
            Bulk stock / prices
          </Button>
          <Button type="button" variant="outline" className="gap-1.5" onClick={openCreateCategory}>
            <FolderPlus className="h-4 w-4" />
            Add category
          </Button>
          <Button type="button" className="gap-1.5" onClick={openCreatePart}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const count = countForCategory(cat.id, cat.matchCategory);
            const selected = cat.id === categoryId;
            const canEdit = Boolean(cat.matchCategory);
            return (
              <div
                key={cat.id}
                className={cn(
                  "relative rounded-xl border text-left transition-colors",
                  selected
                    ? "border-accent bg-accent/10 shadow-sm"
                    : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => selectCategory(cat.id, cat.matchCategory)}
                  className="w-full px-4 py-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          selected ? "text-accent" : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <Badge variant={selected ? "default" : "secondary"}>{count}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </button>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute bottom-2 right-2 h-7 gap-1 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditCategory(cat);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <Card ref={listRef} id="inventory-items">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-accent" />
                {activeCategory?.label ?? "Parts Catalog"}
              </CardTitle>
              {!isCatalogMode && (
                <div className="text-xs text-muted-foreground">
                  Showing pieces:{" "}
                  <span className="font-semibold text-foreground">
                    {totalPieces.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {isCatalogMode && (
              <p className="text-xs text-muted-foreground">
                Browse Kafu catalog parts as a grid. Filter by machine, category, or show all —
                sorted gradually from A01 upward.
              </p>
            )}

            {isORings && (
              <div className="rounded-lg border border-border bg-muted/30">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left md:px-4"
                  onClick={() => setSearchOpen((v) => !v)}
                  aria-expanded={searchOpen}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      O-Ring advanced search
                      {filterActive && (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          CS {thickness.trim()}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searchOpen
                        ? "Filter by thickness (CS). Results default to size (ID) small → large."
                        : "Click to open thickness filters and sort"}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      searchOpen && "rotate-180",
                    )}
                  />
                </button>

                {searchOpen && (
                  <div className="space-y-3 border-t border-border px-3 pb-3 pt-3 md:px-4 md:pb-4">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={sortMode === "size" ? "default" : "ghost"}
                          className="h-8 gap-1.5"
                          onClick={() => setSortMode("size")}
                        >
                          <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                          By size
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={sortMode === "box" ? "default" : "ghost"}
                          className="h-8 gap-1.5"
                          onClick={() => setSortMode("box")}
                        >
                          <Boxes className="h-3.5 w-3.5" />
                          By box
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(220px,280px)_1fr] md:items-start">
                      <div className="space-y-1.5 rounded-md border border-border bg-background p-3">
                        <Label htmlFor="oring-thickness" className="text-xs font-medium">
                          Thickness search (CS mm)
                        </Label>
                        <Input
                          id="oring-thickness"
                          inputMode="decimal"
                          placeholder="e.g. 3.00"
                          value={thickness}
                          onChange={(e) => setThickness(e.target.value)}
                          className="h-10 font-mono"
                          autoComplete="off"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Type a CS thickness to filter O-rings
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Quick thickness</p>
                        <div className="flex flex-wrap gap-1.5">
                          {thicknessPicks.map((n) => {
                            const label = Number.isInteger(n)
                              ? String(n)
                              : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
                            const active = matchesThickness(String(n), thickness);
                            return (
                              <Button
                                key={n}
                                type="button"
                                size="sm"
                                variant={active && thickness.trim() ? "default" : "outline"}
                                className="h-8 font-mono text-xs"
                                onClick={() =>
                                  setThickness(active && thickness.trim() ? "" : label)
                                }
                              >
                                {label}
                              </Button>
                            );
                          })}
                          {thickness.trim() && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => setThickness("")}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {filterActive && (
                      <p className="text-xs text-muted-foreground">
                        {rows.length} O-ring{rows.length === 1 ? "" : "s"} with CS{" "}
                        <span className="font-mono font-medium text-foreground">
                          {thickness.trim()}
                        </span>
                        mm · sorted{" "}
                        {sortMode === "size" ? "by ID (small → large)" : "by box, then ID"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isCatalogMode ? (
              <CatalogGrid
                parts={parts}
                searchQuery={query}
                onView={(p) => openPart(p, "view")}
                onAddToCart={askDocumentForPart}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isORings && <TableHead className="w-14">Photo</TableHead>}
                    {isORings && <TableHead>Box</TableHead>}
                    <TableHead>{isORings ? "Part #" : "Part Code"}</TableHead>
                    {isORings && <TableHead>ID (mm)</TableHead>}
                    {isORings && <TableHead>CS (mm)</TableHead>}
                    {!isORings && <TableHead>Description</TableHead>}
                    {!isORings && <TableHead>OEM / Serial</TableHead>}
                    {!isORings && <TableHead>Machine</TableHead>}
                    {!isORings && <TableHead className="w-16">Page</TableHead>}
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
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
                      <TableRow key={p.id}>
                        {!isORings && (
                          <TableCell>
                            {p.imageUrl ? (
                              <button
                                type="button"
                                className="block overflow-hidden rounded-md border border-border bg-muted/30"
                                onClick={() => openPart(p, "view")}
                                title="View part"
                              >
                                <img
                                  src={p.imageUrl}
                                  alt={p.partNumber}
                                  className="h-11 w-11 object-contain"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
                                —
                              </div>
                            )}
                          </TableCell>
                        )}
                        {isORings && (
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.boxNumber ?? "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <PartNumbersCell part={p} catalogMode={!isORings} />
                        </TableCell>
                        {isORings && (
                          <TableCell className="font-mono text-xs">
                            {p.insideDiameterMm || "—"}
                          </TableCell>
                        )}
                        {isORings && (
                          <TableCell className="font-mono text-xs">
                            {p.crossSectionMm || "—"}
                          </TableCell>
                        )}
                        {!isORings && (
                          <TableCell className="max-w-[200px] text-xs">
                            <span className="line-clamp-2">{description || "—"}</span>
                          </TableCell>
                        )}
                        {!isORings && (
                          <TableCell className="max-w-[160px] font-mono text-xs text-muted-foreground">
                            <span className="line-clamp-2">
                              {oems.length > 0 ? oems.join(" / ") : "—"}
                            </span>
                          </TableCell>
                        )}
                        {!isORings && (
                          <TableCell className="max-w-[180px] text-xs text-muted-foreground">
                            <span className="line-clamp-2">{machine || "—"}</span>
                          </TableCell>
                        )}
                        {!isORings && (
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {page || "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant="secondary">{p.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${low ? "text-accent" : ""}`}
                          >
                            {low && <AlertTriangle className="h-3.5 w-3.5" />}
                            {p.quantity.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {p.cost > 0 ? currency(p.cost) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {p.price > 0 ? currency(p.price) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 px-2"
                              onClick={() => openPart(p, "view")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 px-2"
                              onClick={() => openPart(p, "edit")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1 px-2"
                              onClick={() => askDocumentForPart(p)}
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              Add to cart
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={isORings ? 9 : 9}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        {parts.length === 0
                          ? "No parts yet."
                          : filterActive
                            ? `No O-rings with thickness ${thickness.trim()} mm.`
                            : q
                              ? `No parts match “${query}”.`
                              : `No parts in ${activeCategory?.label ?? "this category"} yet.`}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <PartDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        part={dialogPart}
        mode={dialogMode}
        onModeChange={setDialogMode}
        defaultCategory={activeCategory?.matchCategory ?? ""}
      />
      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        onSaved={(cat) => setCategoryId(cat.id)}
      />
      <BulkStockDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </>
  );
}
