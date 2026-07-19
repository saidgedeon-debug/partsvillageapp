import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { oemNumbersOf, partDescriptionOf } from "@/lib/mock-data";

export const Route = createFileRoute("/stock-take")({
  head: () => ({
    meta: [
      { title: "Stock take — Parts Village" },
      { name: "description", content: "Count or receive stock by part code." },
    ],
  }),
  component: StockTakePage,
});

type Mode = "set" | "receive";

type LogEntry = {
  id: string;
  partNumber: string;
  before: number;
  after: number;
  mode: Mode;
};

function StockTakePage() {
  const { parts, updatePart, catalogReady } = useInventory();
  const [mode, setMode] = useState<Mode>("set");
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);

  const index = useMemo(() => {
    const map = new Map<string, (typeof parts)[0]>();
    for (const p of parts) {
      map.set(p.partNumber.trim().toLowerCase(), p);
      for (const oem of oemNumbersOf(p)) {
        map.set(oem.trim().toLowerCase(), p);
      }
    }
    return map;
  }, [parts]);

  const matched = index.get(code.trim().toLowerCase());

  const apply = () => {
    const n = Number(qty);
    if (!matched) {
      toast.error("Part not found — check the code");
      return;
    }
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    const before = matched.quantity;
    const after = mode === "set" ? Math.floor(n) : before + Math.floor(n);
    updatePart(matched.id, { quantity: Math.max(0, after) });
    setLog((prev) => [
      {
        id: `${matched.id}-${Date.now()}`,
        partNumber: matched.partNumber,
        before,
        after: Math.max(0, after),
        mode,
      },
      ...prev,
    ].slice(0, 40));
    toast.success(
      mode === "set"
        ? `${matched.partNumber}: qty set to ${Math.max(0, after)}`
        : `${matched.partNumber}: +${Math.floor(n)} → ${Math.max(0, after)}`,
    );
    setQty("");
    setCode("");
  };

  return (
    <>
      <PageHeader
        title="Stock take / receive"
        subtitle={
          catalogReady
            ? "Type a part or OEM code, then set counted qty or add received qty"
            : "Loading catalog…"
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/inventory">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to inventory
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-accent" />
              Count entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "set" ? "default" : "outline"}
                onClick={() => setMode("set")}
              >
                Set qty (count)
              </Button>
              <Button
                type="button"
                variant={mode === "receive" ? "default" : "outline"}
                onClick={() => setMode("receive")}
              >
                Add received
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_140px_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="st-code">Part code / OEM</Label>
                <Input
                  id="st-code"
                  className="font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="A01-1 or OEM number"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById("st-qty")?.focus();
                    }
                  }}
                />
                {matched ? (
                  <p className="text-xs text-muted-foreground">
                    {partDescriptionOf(matched)} · on hand{" "}
                    <span className="font-semibold text-foreground">{matched.quantity}</span>
                  </p>
                ) : code.trim() ? (
                  <p className="text-xs text-accent">No match yet</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-qty">{mode === "set" ? "Counted qty" : "Received qty"}</Label>
                <Input
                  id="st-qty"
                  inputMode="numeric"
                  className="font-mono"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      apply();
                    }
                  }}
                />
              </div>
              <Button type="button" className="h-10" disabled={!catalogReady} onClick={apply}>
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {log.length === 0 && (
              <p className="text-sm text-muted-foreground">No counts yet this session.</p>
            )}
            {log.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-mono font-medium">{e.partNumber}</span>
                <span className="text-muted-foreground">
                  {e.mode === "receive" ? "receive" : "count"} · {e.before} →{" "}
                  <span className="font-semibold text-foreground">{e.after}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
