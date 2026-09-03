/** Mid-day cash drawer radar — expected vs optional quick counts. */

import {
  documentAffectsCashDrawer,
  type SavedDocument,
} from "@/components/app/documents-context";
import { localTodayIso } from "@/lib/date-local";

export type DrawerExpected = {
  date: string;
  cash: number;
  omt: number;
  whish: number;
  receiptCount: number;
};

export function computeDrawerExpected(
  documents: SavedDocument[],
  date = localTodayIso(),
): DrawerExpected {
  let cash = 0;
  let omt = 0;
  let whish = 0;
  let receiptCount = 0;
  for (const r of documents) {
    if (!documentAffectsCashDrawer(r)) continue;
    const d = r.paymentDate || r.date;
    if (d !== date) continue;
    receiptCount += 1;
    const amount = Number(r.total) || 0;
    const method = r.paymentMethod ?? "Cash";
    if (method === "OMT") omt += amount;
    else if (method === "Whish") whish += amount;
    else cash += amount;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    date,
    cash: round(cash),
    omt: round(omt),
    whish: round(whish),
    receiptCount,
  };
}

export function drawerVarianceTone(variance: number): "ok" | "warn" | "bad" {
  const a = Math.abs(variance);
  if (a < 0.005) return "ok";
  if (a < 50) return "warn";
  return "bad";
}
