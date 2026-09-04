import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { usePrefs, type ShiftEntry } from "@/components/app/prefs-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localTodayIso } from "@/lib/date-local";
import { computeDrawerExpected } from "@/lib/drawer-radar";
import { currency } from "@/lib/mock-data";

export const Route = createFileRoute("/shift")({
  head: () => ({
    meta: [
      { title: "Shift handoff — Parts Village" },
      { name: "description", content: "Start and hand off cashier shifts with drawer snapshot." },
    ],
  }),
  component: ShiftPage,
});

function ShiftPage() {
  const { documents } = useDocuments();
  const { shifts, startShift, endShift } = usePrefs();
  const [cashierName, setCashierName] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [handoffTo, setHandoffTo] = useState("");
  const [note, setNote] = useState("");

  const openShift = useMemo(() => shifts.find((s) => !s.closedAt), [shifts]);
  const expected = useMemo(() => computeDrawerExpected(documents), [documents]);
  const recent = shifts.slice(0, 12);

  const begin = () => {
    const name = cashierName.trim();
    const cash = Number(openingCash);
    if (!name) {
      toast.error("Enter cashier name");
      return;
    }
    if (!Number.isFinite(cash) || cash < 0) {
      toast.error("Enter opening cash");
      return;
    }
    if (openShift) {
      toast.error("Close the open shift first");
      return;
    }
    startShift({ cashierName: name, openingCash: cash, note: note.trim() || undefined });
    toast.success(`Shift started · ${name}`);
    setNote("");
  };

  const handoff = () => {
    if (!openShift) {
      toast.error("No open shift");
      return;
    }
    const cash = Number(closingCash);
    if (!Number.isFinite(cash) || cash < 0) {
      toast.error("Enter closing cash count");
      return;
    }
    endShift({
      closingCash: cash,
      expectedCash: expected.cash,
      handoffToName: handoffTo.trim() || undefined,
      note: note.trim() || undefined,
    });
    toast.success("Shift handed off");
    setClosingCash("");
    setHandoffTo("");
    setNote("");
  };

  return (
    <>
      <PageHeader
        title="Cashier shift handoff"
        subtitle={`Today’s drawer expected cash ${currency(expected.cash)} · ${expected.receiptCount} receipts`}
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4" />
              {openShift ? `Open · ${openShift.cashierName}` : "Start shift"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openShift ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Opened {new Date(openShift.openedAt).toLocaleString()} · opening cash{" "}
                  {currency(openShift.openingCash)}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="closing-cash">Counted closing cash</Label>
                    <Input
                      id="closing-cash"
                      inputMode="decimal"
                      value={closingCash}
                      onChange={(e) => setClosingCash(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="handoff-to">Hand off to</Label>
                    <Input
                      id="handoff-to"
                      value={handoffTo}
                      onChange={(e) => setHandoffTo(e.target.value)}
                      placeholder="Next cashier name"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-note">Handoff note</Label>
                  <Input
                    id="shift-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Float, pending pickups…"
                  />
                </div>
                <Button type="button" onClick={handoff}>
                  End shift / hand off
                </Button>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cashier">Cashier name</Label>
                    <Input
                      id="cashier"
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="opening-cash">Opening cash</Label>
                    <Input
                      id="opening-cash"
                      inputMode="decimal"
                      value={openingCash}
                      onChange={(e) => setOpeningCash(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="start-note">Note</Label>
                  <Input
                    id="start-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <Button type="button" onClick={begin}>
                  Start shift
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent shifts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shifts recorded yet.</p>
            ) : (
              recent.map((s) => <ShiftRow key={s.id} shift={s} />)
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Business day {localTodayIso()}</p>
      </main>
    </>
  );
}

function ShiftRow({ shift }: { shift: ShiftEntry }) {
  const open = !shift.closedAt;
  const variance =
    shift.closingCash != null && shift.expectedCash != null
      ? shift.closingCash - shift.expectedCash
      : null;
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{shift.cashierName}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(shift.openedAt).toLocaleString()}
            {shift.closedAt ? ` → ${new Date(shift.closedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <Badge variant={open ? "default" : "secondary"}>{open ? "Open" : "Closed"}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Open {currency(shift.openingCash)}
        {shift.closingCash != null ? ` · Close ${currency(shift.closingCash)}` : ""}
        {variance != null ? ` · Var ${currency(variance)}` : ""}
        {shift.handoffToName ? ` · to ${shift.handoffToName}` : ""}
      </p>
      {shift.note ? <p className="mt-1 text-xs">{shift.note}</p> : null}
    </div>
  );
}
