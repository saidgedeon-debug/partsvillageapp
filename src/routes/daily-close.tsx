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
import { computeDrawerExpected } from "@/lib/drawer-radar";
import { currency } from "@/lib/mock-data";
import { downloadZReportPdf } from "@/lib/z-report";

export const Route = createFileRoute("/daily-close")({
  head: () => ({
    meta: [
      { title: "Daily close — Parts Village" },
      {
        name: "description",
        content: "Count Cash, OMT, and Whish against the day’s receipts and cash credits.",
      },
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

function monthKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function currentMonthKey(): string {
  return monthKeyFromDate(localTodayIso());
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function DailyClosePage() {
  const { documents } = useDocuments();
  const { dailyCloses, addDailyClose } = usePrefs();
  const [date, setDate] = useState(localTodayIso);
  const [countedCash, setCountedCash] = useState("");
  const [countedOmt, setCountedOmt] = useState("");
  const [countedWhish, setCountedWhish] = useState("");
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(currentMonthKey);

  const expected = useMemo(
    () => computeDrawerExpected(documents, date),
    [documents, date],
  );

  const cash = parseMoney(countedCash);
  const omt = parseMoney(countedOmt);
  const whish = parseMoney(countedWhish);
  const varCash = cash - expected.cash;
  const varOmt = omt - expected.omt;
  const varWhish = whish - expected.whish;
  const varTotal = varCash + varOmt + varWhish;

  const monthCloses = useMemo(
    () => dailyCloses.filter((e) => monthKeyFromDate(e.date) === month),
    [dailyCloses, month],
  );

  const monthRollup = useMemo(() => {
    const sum = {
      expectedCash: 0,
      expectedOmt: 0,
      expectedWhish: 0,
      countedCash: 0,
      countedOmt: 0,
      countedWhish: 0,
      days: monthCloses.length,
    };
    for (const e of monthCloses) {
      sum.expectedCash += e.expectedCash;
      sum.expectedOmt += e.expectedOmt;
      sum.expectedWhish += e.expectedWhish;
      sum.countedCash += e.countedCash;
      sum.countedOmt += e.countedOmt;
      sum.countedWhish += e.countedWhish;
    }
    return {
      ...sum,
      varCash: sum.countedCash - sum.expectedCash,
      varOmt: sum.countedOmt - sum.expectedOmt,
      varWhish: sum.countedWhish - sum.expectedWhish,
      varTotal:
        sum.countedCash -
        sum.expectedCash +
        (sum.countedOmt - sum.expectedOmt) +
        (sum.countedWhish - sum.expectedWhish),
    };
  }, [monthCloses]);

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

  const exportMonthCsv = () => {
    if (!monthCloses.length) {
      toast.message("No closes in this month");
      return;
    }
    const header = [
      "date",
      "expectedCash",
      "countedCash",
      "varCash",
      "expectedOmt",
      "countedOmt",
      "varOmt",
      "expectedWhish",
      "countedWhish",
      "varWhish",
      "varTotal",
      "note",
    ];
    const lines = [
      header.join(","),
      ...monthCloses
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => {
          const vc = e.countedCash - e.expectedCash;
          const vo = e.countedOmt - e.expectedOmt;
          const vw = e.countedWhish - e.expectedWhish;
          return [
            csvEscape(e.date),
            e.expectedCash,
            e.countedCash,
            vc,
            e.expectedOmt,
            e.countedOmt,
            vo,
            e.expectedWhish,
            e.countedWhish,
            vw,
            vc + vo + vw,
            csvEscape(e.note ?? ""),
          ].join(",");
        }),
      [
        "TOTAL",
        monthRollup.expectedCash,
        monthRollup.countedCash,
        monthRollup.varCash,
        monthRollup.expectedOmt,
        monthRollup.countedOmt,
        monthRollup.varOmt,
        monthRollup.expectedWhish,
        monthRollup.countedWhish,
        monthRollup.varWhish,
        monthRollup.varTotal,
        "",
      ].join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `z-rollup-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Month CSV downloaded");
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
          <CardTitle className="text-base">Monthly Z rollup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="close-month">Month</Label>
              <Input
                id="close-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || currentMonthKey())}
                className="max-w-xs"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!monthCloses.length}
              onClick={exportMonthCsv}
            >
              Export month CSV
            </Button>
          </div>

          {monthCloses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved closes for this month.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["Cash", monthRollup.expectedCash, monthRollup.countedCash, monthRollup.varCash],
                  ["OMT", monthRollup.expectedOmt, monthRollup.countedOmt, monthRollup.varOmt],
                  ["Whish", monthRollup.expectedWhish, monthRollup.countedWhish, monthRollup.varWhish],
                ] as const
              ).map(([label, exp, counted, variance]) => (
                <div key={label} className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">Expected {currency(exp)}</p>
                  <p className="text-xs text-muted-foreground">Counted {currency(counted)}</p>
                  <p>
                    Variance{" "}
                    <span
                      className={
                        Math.abs(variance) < 0.005 ? "text-muted-foreground" : "text-destructive"
                      }
                    >
                      {currency(variance)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {monthCloses.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Month variance</span>
              <Badge variant={varianceTone(monthRollup.varTotal)}>
                {currency(monthRollup.varTotal)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {monthRollup.days} day{monthRollup.days === 1 ? "" : "s"} closed
              </span>
            </div>
          ) : null}
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
