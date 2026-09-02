import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useDocuments } from "@/components/app/documents-context";
import { PageHeader } from "@/components/app/page-header";
import { usePrefs } from "@/components/app/prefs-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localTodayIso } from "@/lib/date-local";
import { currency } from "@/lib/mock-data";
import { downloadZReportPdf } from "@/lib/z-report";

export const Route = createFileRoute("/daily-close")({
  head: () => ({
    meta: [
      { title: "Daily close — Parts Village" },
      { name: "description", content: "Count Cash, OMT, and Whish against the day’s receipts." },
    ],
  }),
  component: DailyClosePage,
});

function parseMoney(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function varianceTone(v: number): "default" | "secondary" | "destructive" | "outline" {
  if (Math.abs(v) < 0.005) return "secondary";
  return "destructive";
}

function DailyClosePage() {
  const { receipts } = useDocuments();
  const { dailyCloses, addDailyClose } = usePrefs();
  const [date, setDate] = useState(localTodayIso);
  const [countedCash, setCountedCash] = useState("");
  const [countedOmt, setCountedOmt] = useState("");
  const [countedWhish, setCountedWhish] = useState("");
  const [note, setNote] = useState("");

  const expected = useMemo(() => {
    let cash = 0;
    let omt = 0;
    let whish = 0;
    let receiptCount = 0;
    for (const r of receipts) {
      const d = r.paymentDate || r.date;
      if (d !== date) continue;
      receiptCount += 1;
      const amount = Number(r.total) || 0;
      const method = r.paymentMethod ?? "Cash";
      if (method === "OMT") omt += amount;
      else if (method === "Whish") whish += amount;
      else cash += amount;
    }
    return { cash, omt, whish, receiptCount };
  }, [receipts, date]);

  const cash = parseMoney(countedCash);
  const omt = parseMoney(countedOmt);
  const whish = parseMoney(countedWhish);
  const varCash = cash - expected.cash;
  const varOmt = omt - expected.omt;
  const varWhish = whish - expected.whish;
  const varTotal = varCash + varOmt + varWhish;

  const printZReport = () => {
    downloadZReportPdf({
      date,
      expectedCash: expected.cash,
      expectedOmt: expected.omt,
      expectedWhish: expected.whish,
      countedCash: cash,
      countedOmt: omt,
      countedWhish: whish,
      note: note.trim() || undefined,
      receiptCount: expected.receiptCount,
    });
  };

  const save = () => {
    addDailyClose({
      date,
      expectedCash: expected.cash,
      expectedOmt: expected.omt,
      expectedWhish: expected.whish,
      countedCash: cash,
      countedOmt: omt,
      countedWhish: whish,
      note: note.trim() || undefined,
    });
    toast.success(`Saved close for ${date}`, {
      action: {
        label: "Print Z-report",
        onClick: () => printZReport(),
      },
    });
    setNote("");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Daily close" subtitle="Reconcile Cash, OMT, and Whish for the day." />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Count</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="close-date">Date</Label>
            <Input
              id="close-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || localTodayIso())}
              className="max-w-xs"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Cash", expected.cash, countedCash, setCountedCash, varCash],
                ["OMT", expected.omt, countedOmt, setCountedOmt, varOmt],
                ["Whish", expected.whish, countedWhish, setCountedWhish, varWhish],
              ] as const
            ).map(([label, exp, counted, setCounted, variance]) => (
              <div key={label} className="space-y-1.5 rounded-md border p-3">
                <Label htmlFor={`counted-${label}`}>{label}</Label>
                <p className="text-xs text-muted-foreground">Expected {currency(exp)}</p>
                <Input
                  id={`counted-${label}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                />
                <p className="text-sm">
                  Variance{" "}
                  <span className={Math.abs(variance) < 0.005 ? "text-muted-foreground" : "text-destructive"}>
                    {currency(variance)}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Total variance</span>
            <Badge variant={varianceTone(varTotal)}>{currency(varTotal)}</Badge>
            <span className="text-xs text-muted-foreground">
              {expected.receiptCount} receipt{expected.receiptCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="close-note">Note</Label>
            <Input
              id="close-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={save}>
              Save close
            </Button>
            <Button type="button" variant="outline" onClick={printZReport}>
              Print Z-report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent closes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dailyCloses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No closes yet.</p>
          ) : (
            dailyCloses.slice(0, 20).map((entry) => {
              const variance =
                entry.countedCash -
                entry.expectedCash +
                (entry.countedOmt - entry.expectedOmt) +
                (entry.countedWhish - entry.expectedWhish);
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{entry.date}</p>
                    <p className="text-xs text-muted-foreground">
                      Cash {currency(entry.countedCash)} · OMT {currency(entry.countedOmt)} · Whish{" "}
                      {currency(entry.countedWhish)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                  <Badge variant={varianceTone(variance)}>{currency(variance)}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
