import type {
  ChinaShipment,
  ShipmentInput,
  ShipmentStatus,
} from "@/components/app/shipments-context";
import type { TitusOrderRow } from "@/lib/titus-scrape";

export type ParsedTitusShipment = {
  trackingNumber: string;
  cartons?: number;
  volumeCbm?: number;
  weightKg?: number;
  title?: string;
  freightMode?: ChinaShipment["freightMode"];
  titusLocation?: string;
  titusStatus?: string;
  containerNo?: string;
  etd?: string;
  eta?: string;
  freightCost?: number;
  orderedAt?: string;
  chinaTracking?: string;
  raw: string;
};

/**
 * Parse text copied from Titus Logistics (user.php / mobile list / Excel paste).
 */
export function parseTitusPaste(text: string): ParsedTitusShipment[] {
  const raw = text.replace(/\u00a0/g, " ").trim();
  if (!raw) return [];

  const byId = new Map<string, ParsedTitusShipment>();

  const blockRe =
    /Shipment\s*No\.?\s*([A-Za-z0-9\-]+).*?(\d+)\s*Ctns?\s*[-–]?\s*([\d.]+)\s*Cbm?\s*[-–]?\s*([\d.]+)\s*KG/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(raw)) !== null) {
    const trackingNumber = m[1].trim().toUpperCase();
    byId.set(trackingNumber, {
      trackingNumber,
      cartons: num(m[2]),
      volumeCbm: num(m[3]),
      weightKg: num(m[4]),
      raw: m[0],
    });
  }

  const lineRe =
    /^\s*(?:Shipment\s*No\.?\s*)?([A-Z]{1,4}\d[\w\-]*)\s*(?:[:：]?\s*Total[：:]?\s*)?(?:(\d+)\s*Ctns?)?(?:\s*[-–]?\s*([\d.]+)\s*Cbm?)?(?:\s*[-–]?\s*([\d.]+)\s*KG)?\s*$/gim;
  while ((m = lineRe.exec(raw)) !== null) {
    const trackingNumber = m[1].trim().toUpperCase();
    if (trackingNumber.length < 4) continue;
    if (byId.has(trackingNumber)) continue;
    byId.set(trackingNumber, {
      trackingNumber,
      cartons: num(m[2]),
      volumeCbm: num(m[3]),
      weightKg: num(m[4]),
      raw: m[0],
    });
  }

  for (const line of raw.split(/\r?\n/)) {
    const parts = line.split(/[\t,;|]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 1) continue;
    const codeMatch = parts[0].match(/(?:Shipment\s*No\.?\s*)?([A-Za-z]{1,4}\d[\w\-]*)/i);
    if (!codeMatch) continue;
    const trackingNumber = codeMatch[1].toUpperCase();
    if (byId.has(trackingNumber)) continue;
    byId.set(trackingNumber, {
      trackingNumber,
      cartons: parts[1] != null ? num(parts[1]) : undefined,
      volumeCbm: parts[2] != null ? num(parts[2]) : undefined,
      weightKg: parts[3] != null ? num(parts[3]) : undefined,
      raw: line,
    });
  }

  return [...byId.values()];
}

function num(v?: string): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function mapTitusFreightMode(
  raw?: string,
): ChinaShipment["freightMode"] | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.includes("air")) return "Air";
  if (s.includes("fcl") || s.includes("full")) return "Sea FCL";
  if (s.includes("lcl") || s.includes("groupage") || s.includes("sea")) return "Sea LCL";
  return "Other";
}

export function mapTitusStatus(raw?: string): ShipmentStatus {
  if (!raw) return "In transit";
  const s = raw.toLowerCase();
  if (
    s.includes("complet") ||
    s.includes("signed") ||
    s.includes("deliver") ||
    s.includes("签收") ||
    s.includes("完成")
  ) {
    return "Arrived";
  }
  if (s.includes("cancel") || s.includes("取消")) return "Cancelled";
  if (
    s.includes("generated") ||
    s.includes("waiting") ||
    s.includes("planned") ||
    s.includes("pre-arranged") ||
    s.includes("prearranged") ||
    s.includes("received") ||
    s.includes("预排") ||
    s.includes("待装") ||
    s.includes("待入")
  ) {
    return "Ordered";
  }
  if (
    s.includes("load") ||
    s.includes("transit") ||
    s.includes("cabinet") ||
    s.includes("在途") ||
    s.includes("已装")
  ) {
    return "In transit";
  }
  return "In transit";
}

export function titusOrderToParsed(row: TitusOrderRow): ParsedTitusShipment {
  const location = [
    row.titusStatus,
    row.containerNo,
    row.etd ? `ETD ${row.etd}` : null,
    row.eta ? `ETA ${row.eta}` : null,
    row.warehouse,
    row.destination,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    trackingNumber: row.orderNo,
    title: row.description,
    cartons: row.cartons,
    volumeCbm: row.volumeCbm,
    weightKg: row.weightKg,
    freightMode: mapTitusFreightMode(row.freightMode) ?? (row.containerNo?.startsWith("AIR") ? "Air" : undefined),
    titusLocation: location || undefined,
    titusStatus: row.titusStatus,
    containerNo: row.containerNo,
    etd: row.etd,
    eta: row.eta,
    freightCost: row.freightCost,
    orderedAt: row.orderedAt,
    chinaTracking: row.chinaTracking,
    raw: `${row.orderNo} ${row.description}`,
  };
}

export function titusParseToInput(p: ParsedTitusShipment): ShipmentInput {
  const noteBits = [
    "Imported from Titus",
    p.chinaTracking ? `China track: ${p.chinaTracking}` : null,
  ].filter(Boolean);

  const stage = p.titusStatus || p.titusLocation;

  return {
    title: (p.title ?? `Titus ${p.trackingNumber}`).trim(),
    supplier: "Titus Logistics",
    orderedAt: p.orderedAt ?? new Date().toISOString().slice(0, 10),
    expectedAt: p.eta,
    trackingNumber: p.trackingNumber,
    status: mapTitusStatus(stage),
    category: "titus",
    cargoType: "divers",
    freightMode: p.freightMode ?? "Other",
    freightCost: p.freightCost,
    freightCurrency: "USD",
    cartons: p.cartons,
    volumeCbm: p.volumeCbm,
    weightKg: p.weightKg,
    titusLocation: p.titusLocation,
    titusStatus: p.titusStatus,
    containerNo: p.containerNo,
    etd: p.etd,
    eta: p.eta,
    currency: "USD",
    notes: noteBits.join(" · "),
  };
}

export function mergeTitusIntoExisting(
  existing: ChinaShipment,
  p: ParsedTitusShipment,
): Partial<ShipmentInput> {
  const patch: Partial<ShipmentInput> = {
    trackingNumber: p.trackingNumber,
    category: "titus",
    cartons: p.cartons ?? existing.cartons,
    volumeCbm: p.volumeCbm ?? existing.volumeCbm,
    weightKg: p.weightKg ?? existing.weightKg,
    supplier: existing.supplier || "Titus Logistics",
    titusLocation: p.titusLocation ?? existing.titusLocation,
    titusStatus: p.titusStatus ?? existing.titusStatus,
    containerNo: p.containerNo ?? existing.containerNo,
    etd: p.etd ?? existing.etd,
    eta: p.eta ?? existing.eta,
    freightMode: p.freightMode ?? existing.freightMode,
  };

  if (p.eta) patch.expectedAt = p.eta;

  if (p.freightCost != null && p.freightCost > 0) {
    patch.freightCost = p.freightCost;
    patch.freightCurrency = "USD";
  }

  if (p.title && (!existing.title || existing.title.startsWith("Titus "))) {
    patch.title = p.title;
  }

  if (
    existing.status !== "Arrived" &&
    existing.status !== "In stock" &&
    existing.status !== "Cancelled"
  ) {
    patch.status = mapTitusStatus(p.titusStatus || p.titusLocation);
  }

  if (p.chinaTracking) {
    const note = existing.notes ?? "";
    if (!note.includes(p.chinaTracking)) {
      patch.notes = note
        ? `${note} · China track: ${p.chinaTracking}`
        : `China track: ${p.chinaTracking}`;
    }
  }

  return patch;
}

export function titusRowHasChanges(
  existing: ChinaShipment,
  p: ParsedTitusShipment,
): boolean {
  if (p.titusStatus && p.titusStatus !== (existing.titusStatus ?? "")) return true;
  if (p.containerNo && p.containerNo !== (existing.containerNo ?? "")) return true;
  if (p.etd && p.etd !== (existing.etd ?? "")) return true;
  if (p.eta && p.eta !== (existing.eta ?? "")) return true;
  if (p.freightCost != null && p.freightCost > 0 && p.freightCost !== existing.freightCost)
    return true;
  const loc = (p.titusLocation ?? "").trim();
  if (loc && loc !== (existing.titusLocation ?? "").trim()) return true;
  if (p.cartons != null && p.cartons !== existing.cartons) return true;
  if (p.volumeCbm != null && p.volumeCbm !== existing.volumeCbm) return true;
  if (p.weightKg != null && p.weightKg !== existing.weightKg) return true;
  if (p.freightMode && p.freightMode !== existing.freightMode) return true;
  if (p.title && p.title !== existing.title && existing.title.startsWith("Titus ")) return true;
  return false;
}
