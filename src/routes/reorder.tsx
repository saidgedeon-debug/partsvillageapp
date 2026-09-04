import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Download, MessageCircle, PackagePlus } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { usePrefs } from "@/components/app/prefs-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildReorderSuggestions } from "@/lib/demand-forecast";
import { normalizePhoneE164 } from "@/lib/phone";

export const Route = createFileRoute("/reorder")({
  head: () => ({
    meta: [
      { title: "Reorder suggestions — Parts Village" },
      {
        name: "description",
        content: "Low-stock and velocity-based reorder candidates for pre-orders.",
      },
    ],
  }),
  component: ReorderPage,
});

function suggestedQty(
  part: { quantity: number; reorderAt: number },
  demand: { suggestedReorderQty: number },
): number {
  return demand.suggestedReorderQty ?? Math.max(1, part.reorderAt - part.quantity);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ReorderPage() {
  const { parts, catalogReady } = useInventory();
  const { invoices } = useDocuments();
  const { suppliers } = useParties();
  const { lastChinaPoDraftAt, markChinaPoDraftSent } = usePrefs();

  const suggestions = useMemo(
    () => buildReorderSuggestions(parts, invoices),
    [parts, invoices],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof suggestions>();
    for (const row of suggestions) {
      const cat = row.part.category?.trim() || "Uncategorized";
      const list = map.get(cat) ?? [];
      list.push(row);
      map.set(cat, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [suggestions]);

  const copyPartNumbers = async () => {
    const text = suggestions.map(({ part }) => part.partNumber).join("\n");
    if (!text) {
      toast.message("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${suggestions.length} part number${suggestions.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const exportCsv = () => {
    if (!suggestions.length) {
      toast.message("Nothing to export");
      return;
    }
    const header = ["partNumber", "name", "qty", "reason", "category"];
    const lines = [
      header.join(","),
      ...suggestions.map(({ part, demand, reason }) =>
        [
          csvEscape(part.partNumber),
          csvEscape(part.name),
          csvEscape(suggestedQty(part, demand)),
          csvEscape(reason),
          csvEscape(part.category || ""),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reorder-suggestions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const whatsappChinaPo = () => {
    if (!suggestions.length) {
      toast.message("Nothing to order");
      return;
    }
    const china =
      suppliers.find((s) => /china|supplier/i.test(`${s.name} ${s.notes ?? ""}`)) ||
      suppliers[0];
    const lines = suggestions
      .slice(0, 40)
      .map(
        ({ part, demand, reason }) =>
          `${part.partNumber} × ${suggestedQty(part, demand)} (${reason})`,
      );
    const text = [
      "Parts Village restock request:",
      "",
      ...lines,
      "",
      suggestions.length > 40 ? `…and ${suggestions.length - 40} more (see CSV).` : "",
      "Please confirm availability and ETA. Thank you.",
    ]
      .filter(Boolean)
      .join("\n");

    // Also trigger CSV so they can attach from phone Files
    exportCsv();

    const phone = china ? normalizePhoneE164(china.phone) : null;
    const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    markChinaPoDraftSent();
    toast.success(
      china
        ? `WhatsApp opened for ${china.name} — attach the CSV if needed`
        : "WhatsApp opened — pick your China supplier chat",
    );
  };

  const daysSinceDraft = useMemo(() => {
    if (!lastChinaPoDraftAt) return 999;
    const then = new Date(lastChinaPoDraftAt).getTime();
    if (!Number.isFinite(then)) return 999;
    return Math.floor((Date.now() - then) / 86_400_000);
  }, [lastChinaPoDraftAt]);
  const weeklyDue = suggestions.length > 0 && daysSinceDraft >= 7;

  return (
    <>
      <PageHeader
        title="Reorder suggestions"
        subtitle={
          catalogReady
            ? `${suggestions.length} part${suggestions.length === 1 ? "" : "s"} to consider`
            : "Loading catalog…"
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {weeklyDue ? (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">Weekly China PO draft is due</p>
                <p className="text-sm text-muted-foreground">
                  {lastChinaPoDraftAt
                    ? `Last sent ${daysSinceDraft} day${daysSinceDraft === 1 ? "" : "s"} ago`
                    : "No draft sent yet"}{" "}
                  · {suggestions.length} parts to consider
                </p>
              </div>
              <Button type="button" className="gap-1.5" onClick={whatsappChinaPo}>
                <MessageCircle className="h-4 w-4" />
                Send weekly draft
              </Button>
            </CardContent>
          </Card>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/inventory">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to inventory
            </Link>
          </Button>
          <Button asChild type="button" size="sm" className="gap-1.5">
            <Link
              to="/pre-orders"
              onClick={() =>
                toast.message("Create pre-order manually from these part numbers")
              }
            >
              <PackagePlus className="h-3.5 w-3.5" />
              Open pre-orders
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!suggestions.length}
            onClick={() => void copyPartNumbers()}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy part numbers
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={!suggestions.length}
            onClick={whatsappChinaPo}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp China PO
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!suggestions.length}
            onClick={exportCsv}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        {suggestions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackagePlus className="h-4 w-4 text-muted-foreground" />
                Suggested reorders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <EmptyState title="No reorder suggestions right now" icon={PackagePlus} />
            </CardContent>
          </Card>
        ) : (
          grouped.map(([category, rows]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackagePlus className="h-4 w-4 text-muted-foreground" />
                  {category}
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {rows.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Reorder at</TableHead>
                      <TableHead className="text-right">Avg/mo</TableHead>
                      <TableHead className="text-right">Suggest qty</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ part, demand, reason }) => (
                      <TableRow key={part.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {part.partNumber}
                        </TableCell>
                        <TableCell className="max-w-[12rem] truncate text-sm">
                          {part.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{part.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{part.reorderAt}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {demand.avgPerMonth}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="tabular-nums">
                            {suggestedQty(part, demand)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[14rem] text-xs text-muted-foreground">
                          {reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </>
  );
}
