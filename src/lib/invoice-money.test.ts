import { describe, expect, it } from "vitest";

/** Minimal doc shape matching SavedDocument fields used by invoice money helpers. */
type MoneyDoc = {
  id: string;
  kind: string;
  total: number;
  status?: string;
  amountPaid?: number;
  invoiceId?: string;
};

/** Mirrors documents-context `invoiceAmountPaid`. */
function invoiceAmountPaid(inv: MoneyDoc): number {
  if (inv.kind !== "invoice") return 0;
  if (typeof inv.amountPaid === "number" && Number.isFinite(inv.amountPaid)) {
    return Math.max(0, inv.amountPaid);
  }
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  return inv.status === "Paid" ? total : 0;
}

/** Mirrors documents-context `invoiceCredits`. */
function invoiceCredits(inv: MoneyDoc, creditNotes: MoneyDoc[] = []): number {
  if (inv.kind !== "invoice") return 0;
  const sum = creditNotes
    .filter((d) => d.kind === "credit_note" && d.invoiceId === inv.id)
    .reduce((s, d) => s + (Number.isFinite(d.total) ? d.total : 0), 0);
  return Math.max(0, Math.round(sum * 100) / 100);
}

/** Mirrors documents-context `invoiceRemaining`. */
function invoiceRemaining(inv: MoneyDoc, creditNotes: MoneyDoc[] = []): number {
  const total = Number.isFinite(inv.total) ? inv.total : 0;
  const paid = invoiceAmountPaid(inv);
  const credits = invoiceCredits(inv, creditNotes);
  return Math.max(0, Math.round((total - paid - credits) * 100) / 100);
}

describe("invoiceCredits / invoiceRemaining", () => {
  it("sums linked credit notes only", () => {
    const invoice: MoneyDoc = { id: "inv-1", kind: "invoice", total: 100, amountPaid: 20 };
    const credits: MoneyDoc[] = [
      { id: "cn-1", kind: "credit_note", total: 15, invoiceId: "inv-1" },
      { id: "cn-2", kind: "credit_note", total: 10, invoiceId: "inv-other" },
      { id: "cn-3", kind: "credit_note", total: 5, invoiceId: "inv-1" },
    ];
    expect(invoiceCredits(invoice, credits)).toBe(20);
  });

  it("computes remaining as total - paid - credits", () => {
    const invoice: MoneyDoc = { id: "inv-1", kind: "invoice", total: 100, amountPaid: 30 };
    const credits: MoneyDoc[] = [
      { id: "cn-1", kind: "credit_note", total: 25, invoiceId: "inv-1" },
    ];
    expect(invoiceRemaining(invoice, credits)).toBe(45);
  });

  it("floors remaining at zero", () => {
    const invoice: MoneyDoc = { id: "inv-1", kind: "invoice", total: 50, amountPaid: 40 };
    const credits: MoneyDoc[] = [
      { id: "cn-1", kind: "credit_note", total: 20, invoiceId: "inv-1" },
    ];
    expect(invoiceRemaining(invoice, credits)).toBe(0);
  });

  it("returns 0 credits for non-invoices", () => {
    const receipt: MoneyDoc = { id: "rcp-1", kind: "receipt", total: 10, status: "Paid" };
    expect(invoiceCredits(receipt, [])).toBe(0);
  });
});
