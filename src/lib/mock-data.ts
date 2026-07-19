export type Part = {
  id: string;
  /** Catalog part code (e.g. A03-12). */
  partNumber: string;
  /** Part code + OEM / serial numbers (primary first). */
  partNumbers?: string[];
  /** Display name (often description — machine). */
  name: string;
  /** Part Description / Specifics (catalog column). */
  description?: string;
  category: string;
  quantity: number;
  reorderAt: number;
  cost: number;
  price: number;
  /** Machine Compatibility / Brand (catalog column). */
  compatibility: string[];
  /** Catalog page number (e.g. "9"). */
  catalogPage?: string;
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

/** OEM / serial numbers only (excludes primary catalog part code). */
export function oemNumbersOf(part: Part): string[] {
  const primary = (part.partNumber ?? "").trim().toLowerCase();
  return partNumbersOf(part).filter((n) => n.trim().toLowerCase() !== primary);
}

/** Part Description / Specifics for table display. */
export function partDescriptionOf(part: Part): string {
  if (part.description?.trim()) return part.description.trim();
  if (part.name.includes(" — ")) return part.name.split(" — ")[0] ?? part.name;
  return part.name;
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

/**
 * Live catalog is lazy-loaded via InventoryProvider (`loadCatalogParts`).
 * Kept empty so importing mock-data does not pull the ~1MB inventory bundles.
 */
export const parts: Part[] = [];

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
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export const totalSales = 0;
export const activeQuotesCount = 0;
export const lowStockParts: Part[] = [];
