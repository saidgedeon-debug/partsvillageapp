import { describe, expect, it } from "vitest";

import { healDocumentsAmountPaid } from "./document-money-heal";
import {
  invoiceAmountPaid,
  invoiceCredits,
  invoiceRemaining,
} from "./invoice-balance";

type MoneyDoc = {
  id: string;
  kind: string;
  total: number;
  status?: string;
  amountPaid?: number;
  invoiceId?: string;
  affectsBalance?: boolean;
  internalNote?: string | null;
};

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

  it("uses affecting receipts when amountPaid is stale or zero", () => {
    const invoice: MoneyDoc = { id: "inv-1", kind: "invoice", total: 100, amountPaid: 0, status: "Unpaid" };
    const documents: MoneyDoc[] = [
      invoice,
      { id: "r1", kind: "receipt", total: 60, invoiceId: "inv-1", affectsBalance: true },
      { id: "r2", kind: "receipt", total: 40, invoiceId: "inv-1", affectsBalance: true },
    ];
    expect(invoiceAmountPaid(invoice, documents)).toBe(100);
    expect(invoiceRemaining(invoice, [], documents)).toBe(0);
  });

  it("keeps stored amountPaid when there are no affecting receipts", () => {
    const invoice: MoneyDoc = { id: "inv-1", kind: "invoice", total: 80, amountPaid: 80, status: "Paid" };
    expect(invoiceAmountPaid(invoice, [invoice])).toBe(80);
    expect(invoiceRemaining(invoice, [], [invoice])).toBe(0);
  });

  it("ignores paperwork-only receipts when stored amountPaid already covers the bill", () => {
    const invoice: MoneyDoc = { id: "inv-1", kind: "invoice", total: 50, amountPaid: 50, status: "Paid" };
    const documents: MoneyDoc[] = [
      invoice,
      {
        id: "r1",
        kind: "receipt",
        total: 50,
        invoiceId: "inv-1",
        internalNote: "Receipt created for already-paid invoice",
      },
    ];
    expect(invoiceAmountPaid(invoice, documents)).toBe(50);
    expect(invoiceRemaining(invoice, [], documents)).toBe(0);
  });

  it("uses a paperwork receipt when amountPaid was lost and the invoice looks unpaid", () => {
    const invoice: MoneyDoc = { id: "inv-1", kind: "invoice", total: 780, amountPaid: 0, status: "Unpaid" };
    const documents: MoneyDoc[] = [
      invoice,
      {
        id: "r1",
        kind: "receipt",
        total: 780,
        invoiceId: "inv-1",
        affectsBalance: false,
        internalNote: "Receipt created for already-paid invoice",
      },
    ];
    expect(invoiceAmountPaid(invoice, documents)).toBe(780);
    expect(invoiceRemaining(invoice, [], documents)).toBe(0);
  });

  it("counts only the real $500 when a merged duplicate receipt is paperwork", () => {
    const invoice: MoneyDoc = {
      id: "inv-1",
      kind: "invoice",
      total: 985,
      amountPaid: 999.99,
      status: "Paid",
    };
    const documents: MoneyDoc[] = [
      invoice,
      { id: "r1", kind: "receipt", total: 500, invoiceId: "inv-1", affectsBalance: true },
      { id: "r2", kind: "receipt", total: 499.99, invoiceId: "inv-1", affectsBalance: false },
    ];
    expect(invoiceAmountPaid(invoice, documents)).toBe(500);
    expect(invoiceRemaining(invoice, [], documents)).toBe(485);
  });
});

describe("healDocumentsAmountPaid", () => {
  it("sets amountPaid from receipts when receipts exist", () => {
    const healed = healDocumentsAmountPaid([
      { id: "inv-1", kind: "invoice", total: 100, amountPaid: 0, status: "Unpaid" },
      { id: "r1", kind: "receipt", invoiceId: "inv-1", total: 100, affectsBalance: true },
    ]) as Array<{ id: string; amountPaid?: number; status?: string }>;
    const inv = healed.find((d) => d.id === "inv-1");
    expect(inv?.amountPaid).toBe(100);
    expect(inv?.status).toBe("Paid");
  });

  it("does not wipe a legacy paid invoice that has no receipt rows", () => {
    const healed = healDocumentsAmountPaid([
      { id: "inv-1", kind: "invoice", total: 75, amountPaid: 75, status: "Paid" },
    ]) as Array<{ id: string; amountPaid?: number; status?: string }>;
    const inv = healed.find((d) => d.id === "inv-1");
    expect(inv?.amountPaid).toBe(75);
    expect(inv?.status).toBe("Paid");
  });

  it("heals an unpaid invoice whose only receipt is paperwork for an already-paid bill", () => {
    const healed = healDocumentsAmountPaid([
      { id: "inv-1", kind: "invoice", total: 50, amountPaid: 0, status: "Unpaid" },
      {
        id: "r1",
        kind: "receipt",
        invoiceId: "inv-1",
        total: 50,
        affectsBalance: false,
        internalNote: "Receipt created for already-paid invoice",
      },
    ]) as Array<{ id: string; amountPaid?: number; status?: string }>;
    const inv = healed.find((d) => d.id === "inv-1");
    expect(inv?.amountPaid).toBe(50);
    expect(inv?.status).toBe("Paid");
  });
});
