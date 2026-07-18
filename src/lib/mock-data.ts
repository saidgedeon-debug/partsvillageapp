export type Part = {
  id: string;
  partNumber: string;
  name: string;
  category: string;
  quantity: number;
  reorderAt: number;
  cost: number;
  price: number;
  compatibility: string[];
};

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

export const parts: Part[] = [
  { id: "p1", partNumber: "CAT-1R-0750", name: "Fuel Filter", category: "Filters", quantity: 42, reorderAt: 20, cost: 18, price: 34, compatibility: ["CAT 320D", "CAT 336F"] },
  { id: "p2", partNumber: "KOM-6754-81-9540", name: "Air Filter Element", category: "Filters", quantity: 8, reorderAt: 15, cost: 55, price: 112, compatibility: ["Komatsu PC200-8", "Komatsu PC220-8"] },
  { id: "p3", partNumber: "VOL-15082709", name: "Track Chain Assembly", category: "Undercarriage", quantity: 3, reorderAt: 2, cost: 2400, price: 4150, compatibility: ["Volvo EC210", "Volvo EC220"] },
  { id: "p4", partNumber: "JD-RE504836", name: "Hydraulic Pump", category: "Hydraulics", quantity: 5, reorderAt: 3, cost: 1800, price: 3200, compatibility: ["John Deere 310L", "John Deere 410L"] },
  { id: "p5", partNumber: "CAT-234-4642", name: "Bucket Tooth", category: "Attachments", quantity: 120, reorderAt: 40, cost: 24, price: 48, compatibility: ["CAT 320D", "CAT 349F"] },
  { id: "p6", partNumber: "BOB-7024037", name: "Drive Motor", category: "Hydraulics", quantity: 2, reorderAt: 2, cost: 3100, price: 5400, compatibility: ["Bobcat S650", "Bobcat T770"] },
  { id: "p7", partNumber: "CAT-9X-8802", name: "Cutting Edge", category: "Attachments", quantity: 18, reorderAt: 10, cost: 210, price: 385, compatibility: ["CAT D6T", "CAT D8T"] },
  { id: "p8", partNumber: "KOM-208-70-14152", name: "Bucket Pin", category: "Attachments", quantity: 6, reorderAt: 12, cost: 85, price: 165, compatibility: ["Komatsu PC300-8", "Komatsu PC400-8"] },
  { id: "p9", partNumber: "JD-AT310588", name: "Alternator 12V", category: "Electrical", quantity: 11, reorderAt: 5, cost: 240, price: 445, compatibility: ["John Deere 310L", "John Deere 544K"] },
  { id: "p10", partNumber: "VOL-11110961", name: "Starter Motor", category: "Electrical", quantity: 4, reorderAt: 4, cost: 380, price: 690, compatibility: ["Volvo L120H", "Volvo L150H"] },
];

export const clients: Client[] = [
  { id: "c1", name: "Ironclad Excavation Co.", contactName: "Marcus Reid", email: "marcus@ironclad.co", phone: "+1 555-0142", address: "1420 Foundry Rd, Pittsburgh, PA" },
  { id: "c2", name: "Bluewater Construction", contactName: "Elena Vasquez", email: "elena@bluewater.build", phone: "+1 555-0187", address: "88 Harbor Way, Tampa, FL" },
  { id: "c3", name: "Highland Quarry LLC", contactName: "Ronan McKay", email: "ronan@highlandq.com", phone: "+1 555-0219", address: "776 Ridge Line, Denver, CO" },
  { id: "c4", name: "Northwind Logging", contactName: "Sara Nilsen", email: "sara@northwindlog.com", phone: "+1 555-0304", address: "12 Timber Rd, Bend, OR" },
  { id: "c5", name: "Delta Road Works", contactName: "Jamal Carter", email: "jamal@deltaroads.com", phone: "+1 555-0355", address: "301 Asphalt Ave, Houston, TX" },
];

export const machines: Machine[] = [
  { id: "m1", clientId: "c1", make: "CAT", model: "320D", serialNumber: "SN-9F02214", year: 2019, hours: 6420 },
  { id: "m2", clientId: "c1", make: "CAT", model: "349F", serialNumber: "SN-3H10087", year: 2021, hours: 3120 },
  { id: "m3", clientId: "c2", make: "Komatsu", model: "PC200-8", serialNumber: "SN-KM88401", year: 2018, hours: 8890 },
  { id: "m4", clientId: "c2", make: "Volvo", model: "EC210", serialNumber: "SN-VO55221", year: 2020, hours: 4510 },
  { id: "m5", clientId: "c3", make: "CAT", model: "D8T", serialNumber: "SN-D8T7723", year: 2017, hours: 11200 },
  { id: "m6", clientId: "c3", make: "Komatsu", model: "PC400-8", serialNumber: "SN-PC44018", year: 2022, hours: 1890 },
  { id: "m7", clientId: "c4", make: "John Deere", model: "310L", serialNumber: "SN-JD31099", year: 2021, hours: 2760 },
  { id: "m8", clientId: "c5", make: "Volvo", model: "L150H", serialNumber: "SN-VL15012", year: 2019, hours: 7010 },
  { id: "m9", clientId: "c5", make: "Bobcat", model: "S650", serialNumber: "SN-BS65044", year: 2023, hours: 620 },
];

export const orders: Order[] = [
  { id: "o1", clientId: "c1", machineId: "m1", date: "2026-06-14", status: "Paid", lines: [{ partId: "p1", qty: 4, unitPrice: 34 }, { partId: "p5", qty: 12, unitPrice: 48 }] },
  { id: "o2", clientId: "c1", machineId: "m2", date: "2026-05-02", status: "Paid", lines: [{ partId: "p5", qty: 8, unitPrice: 48 }] },
  { id: "o3", clientId: "c2", machineId: "m3", date: "2026-06-30", status: "Pending", lines: [{ partId: "p2", qty: 2, unitPrice: 112 }, { partId: "p8", qty: 4, unitPrice: 165 }] },
  { id: "o4", clientId: "c2", machineId: "m4", date: "2026-07-05", status: "Paid", lines: [{ partId: "p3", qty: 1, unitPrice: 4150 }] },
  { id: "o5", clientId: "c3", machineId: "m5", date: "2026-04-19", status: "Paid", lines: [{ partId: "p7", qty: 2, unitPrice: 385 }] },
  { id: "o6", clientId: "c3", machineId: "m6", date: "2026-07-11", status: "Quoted", lines: [{ partId: "p8", qty: 6, unitPrice: 165 }] },
  { id: "o7", clientId: "c4", machineId: "m7", date: "2026-06-24", status: "Paid", lines: [{ partId: "p4", qty: 1, unitPrice: 3200 }, { partId: "p9", qty: 1, unitPrice: 445 }] },
  { id: "o8", clientId: "c5", machineId: "m8", date: "2026-07-08", status: "Paid", lines: [{ partId: "p10", qty: 1, unitPrice: 690 }] },
  { id: "o9", clientId: "c5", machineId: "m9", date: "2026-07-15", status: "Pending", lines: [{ partId: "p6", qty: 1, unitPrice: 5400 }] },
];

export const quotations: Quotation[] = [
  { id: "Q-2026-0141", clientId: "c3", date: "2026-07-11", total: 990, status: "Sent" },
  { id: "Q-2026-0142", clientId: "c1", date: "2026-07-14", total: 2860, status: "Draft" },
  { id: "Q-2026-0143", clientId: "c5", date: "2026-07-15", total: 5400, status: "Accepted" },
  { id: "Q-2026-0140", clientId: "c2", date: "2026-07-02", total: 780, status: "Rejected" },
];

export const invoices: Invoice[] = [
  { id: "INV-2026-2201", clientId: "c1", date: "2026-06-14", total: 712, status: "Paid" },
  { id: "INV-2026-2202", clientId: "c2", date: "2026-07-05", total: 4150, status: "Paid" },
  { id: "INV-2026-2203", clientId: "c4", date: "2026-06-24", total: 3645, status: "Unpaid" },
  { id: "INV-2026-2199", clientId: "c3", date: "2026-05-10", total: 1120, status: "Overdue" },
];

export const supplierInquiries: SupplierInquiry[] = [
  { id: "SI-2026-081", supplier: "Caterpillar Global Parts", date: "2026-07-12", partNumbers: ["CAT-234-4642", "CAT-9X-8802"], status: "Answered" },
  { id: "SI-2026-082", supplier: "Komatsu OEM Direct", date: "2026-07-14", partNumbers: ["KOM-208-70-14152"], status: "Open" },
  { id: "SI-2026-083", supplier: "Volvo CE Distribution", date: "2026-07-15", partNumbers: ["VOL-15082709"], status: "Open" },
];

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