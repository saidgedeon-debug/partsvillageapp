import { oringParts } from "@/lib/orings-inventory";
import { kafuParts } from "@/lib/kafu-inventory";

export type Part = {
  id: string;
  partNumber: string;
  /** Extra / OEM part numbers (shown via + when more than one total). */
  partNumbers?: string[];
  name: string;
  category: string;
  quantity: number;
  reorderAt: number;
  cost: number;
  price: number;
  compatibility: string[];
  /** Storage box number (O-rings inventory). */
  boxNumber?: number;
  /** Inside diameter in mm (or "Metric ID" when unknown). */
  insideDiameterMm?: string;
  /** Cross-section / thickness in mm (or "Metric CS" when unknown). */
  crossSectionMm?: string;
  /** Bag breakdown or other notes. */
  notes?: string;
  /** Public URL for product photo (e.g. /kafu-parts/A01-1.jpg). */
  imageUrl?: string;
};

/** Primary + OEM / alternate part numbers for display. */
export function partNumbersOf(part: Part): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw?: string) => {
    const t = (raw ?? "").trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  if (part.partNumbers?.length) {
    for (const n of part.partNumbers) add(n);
  } else {
    add(part.partNumber);
    const oemBlock = part.notes?.match(/OEM:\s*([^·]+)/i)?.[1];
    if (oemBlock) {
      for (const piece of oemBlock.split(/[,;]/)) add(piece);
    }
  }

  if (out.length === 0) add(part.partNumber);
  return out;
}

export type Machine = {
  id: string;
  clientId: string;
  make: string;
  model: string;
  serialNumber: string;
  year: number;
  hours: number;
};

export type Client = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
};

export type Order = {
  id: string;
  clientId: string;
  machineId: string;
  date: string;
  status: "Paid" | "Pending" | "Quoted";
  lines: { partId: string; qty: number; unitPrice: number }[];
};

export type Quotation = {
  id: string;
  clientId: string;
  date: string;
  total: number;
  status: "Draft" | "Sent" | "Accepted" | "Rejected";
};

export type Invoice = {
  id: string;
  clientId: string;
  date: string;
  total: number;
  status: "Paid" | "Unpaid" | "Overdue";
};

export type SupplierInquiry = {
  id: string;
  supplier: string;
  date: string;
  partNumbers: string[];
  status: "Open" | "Answered" | "Closed";
};

export const parts: Part[] = [...oringParts, ...(kafuParts as Part[])];

export const clients: Client[] = [];

export const machines: Machine[] = [];

export const orders: Order[] = [];

export const quotations: Quotation[] = [];

export const invoices: Invoice[] = [];

export const supplierInquiries: SupplierInquiry[] = [];

export const clientById = (id: string) => clients.find((c) => c.id === id);
export const partById = (id: string) => parts.find((p) => p.id === id);
export const machinesByClient = (id: string) => machines.filter((m) => m.clientId === id);
export const ordersByClient = (id: string) => orders.filter((o) => o.clientId === id);
export const ordersByMachine = (id: string) => orders.filter((o) => o.machineId === id);

export const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const totalSales = invoices
  .filter((i) => i.status === "Paid")
  .reduce((s, i) => s + i.total, 0) +
  orders
    .filter((o) => o.status === "Paid")
    .reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.qty * l.unitPrice, 0), 0);

export const activeQuotesCount = quotations.filter((q) => q.status === "Sent" || q.status === "Draft").length;
export const lowStockParts = parts.filter((p) => p.quantity <= p.reorderAt);