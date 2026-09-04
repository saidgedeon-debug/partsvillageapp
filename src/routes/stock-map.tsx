import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Package } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useInventory } from "@/components/app/inventory-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { locationOf, partNumbersOf, type Part } from "@/lib/mock-data";

export const Route = createFileRoute("/stock-map")({
  head: () => ({
    meta: [
      { title: "Stock location map — Parts Village" },
      {
        name: "description",
        content: "Find parts by aisle, shelf, box, or catalog page.",
      },
    ],
  }),
  component: StockMapPage,
});

function StockMapPage() {
  const { parts, catalogReady } = useInventory();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, Part[]>();
    const needle = q.trim().toLowerCase();
    for (const part of parts) {
      if (part.quantity <= 0 && !needle) continue;
      const loc = locationOf(part) || "Unassigned";
      if (needle) {
        const blob = [
          loc,
          part.partNumber,
          part.name,
          partNumbersOf(part).join(" "),
          String(part.boxNumber ?? ""),
          part.catalogPage ?? "",
          part.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(needle)) continue;
      }
      const list = map.get(loc) ?? [];
      list.push(part);
      map.set(loc, list);
    }
    return [...map.entries()]
      .map(([location, rows]) => ({
        location,
        rows: rows.sort((a, b) => a.partNumber.localeCompare(b.partNumber)).slice(0, 40),
        total: rows.length,
      }))
      .sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true }));
  }, [parts, q]);

  return (
    <>
      <PageHeader
        title="Stock location map"
        subtitle={
          catalogReady
            ? "Search aisle / shelf / box / page — tip: put Loc: A-12 in part notes"
            : "Loading catalog…"
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find location or part #…"
          className="h-11 max-w-lg text-base"
          enterKeyHint="search"
        />
        {groups.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No locations matched"
            description="Try another search, or add Loc: shelf-name in a part’s notes."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.location}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-accent" />
                      {g.location}
                    </span>
                    <Badge variant="secondary">{g.total}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.rows.map((p) => (
                    <Link
                      key={p.id}
                      to="/search"
                      search={{ q: p.partNumber }}
                      className="flex items-start gap-2 rounded-md border border-border px-2 py-2 hover:bg-muted/40"
                    >
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold">{p.partNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">qty {p.quantity}</p>
                      </div>
                    </Link>
                  ))}
                  {g.total > g.rows.length ? (
                    <p className="text-xs text-muted-foreground">
                      +{g.total - g.rows.length} more at this location
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
