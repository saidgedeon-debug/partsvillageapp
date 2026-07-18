import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpNarrowWide, Package, Boxes } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parts, currency, type Part } from "@/lib/mock-data";

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
  const q = query.trim().toLowerCase();
  const [thickness, setThickness] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("size");

  const thicknessPicks = useMemo(() => {
    const nums = new Set<number>();
    for (const p of parts) {
      if (p.category !== "O-Rings") continue;
      const n = parseMm(p.crossSectionMm);
      if (n != null) nums.add(n);
    }
    return [...nums].sort((a, b) => a - b);
  }, []);

  const rows = useMemo(() => {
    let list = parts;

    if (thickness.trim()) {
      list = list.filter(
        (p) => p.category === "O-Rings" && matchesThickness(p.crossSectionMm, thickness),
      );
    }

    if (q) {
      list = list.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          String(p.boxNumber ?? "").includes(q) ||
          (p.insideDiameterMm ?? "").toLowerCase().includes(q) ||
          (p.crossSectionMm ?? "").toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q) ||
          p.compatibility.some((c) => c.toLowerCase().includes(q)),
      );
    }

    return sortParts(list, sortMode);
  }, [q, thickness, sortMode]);

  const categories = useMemo(() => [...new Set(parts.map((p) => p.category))], []);
  const filterActive = Boolean(thickness.trim());
  const totalPieces = rows.reduce((s, p) => s + p.quantity, 0);

  return (
    <>
      <PageHeader
        title="Stock / Inventory"
        subtitle={`${rows.length} of ${parts.length} parts · ${categories.join(", ") || "No categories"}`}
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-accent" /> Parts Catalog
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                Showing pieces:{" "}
                <span className="font-semibold text-foreground">{totalPieces.toLocaleString()}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 md:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">O-Ring advanced search</p>
                  <p className="text-xs text-muted-foreground">
                    Filter by thickness (CS). Results default to size (ID) small → large.
                  </p>
                </div>
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

              <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr] md:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="oring-thickness" className="text-xs">
                    Thickness CS (mm)
                  </Label>
                  <Input
                    id="oring-thickness"
                    inputMode="decimal"
                    placeholder="e.g. 3.00"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    className="h-10 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Quick thickness</p>
                  <div className="flex flex-wrap gap-1.5">
                    {thicknessPicks.slice(0, 16).map((n) => {
                      const label = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
                      const active = matchesThickness(String(n), thickness);
                      return (
                        <Button
                          key={n}
                          type="button"
                          size="sm"
                          variant={active && thickness.trim() ? "default" : "outline"}
                          className="h-8 font-mono text-xs"
                          onClick={() => setThickness(active && thickness.trim() ? "" : label)}
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
                <p className="mt-3 text-xs text-muted-foreground">
                  {rows.length} O-ring{rows.length === 1 ? "" : "s"} with CS{" "}
                  <span className="font-mono font-medium text-foreground">{thickness.trim()}</span>
                  mm · sorted {sortMode === "size" ? "by ID (small → large)" : "by box, then ID"}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Box</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>ID (mm)</TableHead>
                  <TableHead>CS (mm)</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const low = p.quantity > 0 && p.quantity <= p.reorderAt;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.boxNumber ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">{p.partNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{p.insideDiameterMm || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{p.crossSectionMm || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center gap-1 font-semibold ${low ? "text-accent" : ""}`}>
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
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {p.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                      {parts.length === 0
                        ? "No parts yet."
                        : filterActive
                          ? `No O-rings with thickness ${thickness.trim()} mm.`
                          : `No parts match “${query}”.`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
