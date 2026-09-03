import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rankByFuzzyScore } from "@/lib/fuzzy-search";
import { currency, locationOf, partNumbersOf, type Part } from "@/lib/mock-data";
import { printPartLabels } from "@/lib/part-label";

export const Route = createFileRoute("/labels")({
  head: () => ({
    meta: [
      { title: "Label station — Parts Village" },
      { name: "description", content: "Print barcode shelf labels for Bluetooth or system printers." },
    ],
  }),
  component: LabelsPage,
});

function LabelsPage() {
  const { parts } = useInventory();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const needle = q.trim();
    if (!needle) return parts.slice(0, 80);
    return rankByFuzzyScore(
      parts,
      needle,
      (p) =>
        [partNumbersOf(p).join(" "), p.name, locationOf(p), String(p.boxNumber ?? "")].join(" "),
      80,
    );
  }, [parts, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const print = async () => {
    const list = parts.filter((p) => selected.has(p.id));
    if (!list.length) {
      toast.message("Select parts to print");
      return;
    }
    await printPartLabels(list);
    toast.success(`Opened ${list.length} label${list.length === 1 ? "" : "s"} — use Print / AirPrint / Bluetooth`);
  };

  return (
    <>
      <PageHeader
        title="Label print station"
        subtitle="Barcode + box # + price — print to AirPrint or Bluetooth printers from the phone"
        actions={
          <Button type="button" className="gap-1.5" onClick={() => void print()}>
            <Printer className="h-4 w-4" />
            Print {selected.size || ""}
          </Button>
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search part #, name, box…"
          className="max-w-md"
        />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Part</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p: Part) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => toggle(p.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold">{p.partNumber}</div>
                      <div className="text-xs text-muted-foreground">{p.name}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {locationOf(p) || (p.boxNumber != null ? `Box ${p.boxNumber}` : "—")}
                    </TableCell>
                    <TableCell className="text-right">{currency(p.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
