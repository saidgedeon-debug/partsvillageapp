import { oemNumbersOf, partNumbersOf, type Part } from "@/lib/mock-data";

/** Catalog rows archived after a merge — hide from duplicate detection. */
export function isArchivedMergedPart(part: {
  partNumber?: string;
  notes?: string;
}): boolean {
  const code = (part.partNumber ?? "").trim();
  if (code.startsWith("__merged__")) return true;
  return (part.notes ?? "").includes("Merged into");
}

export function normalizedPartCodes(part: {
  partNumber?: string;
  partNumbers?: string[];
}): string[] {
  const raw = partNumbersOf({
    partNumber: part.partNumber ?? "",
    partNumbers: part.partNumbers,
  } as Part);
  return raw.map((n) => n.trim().toLowerCase()).filter(Boolean);
}

/** All codes used for smart duplicate detection (primary + OEM/cross-refs). */
export function smartDuplicateCodes(part: Part): string[] {
  const codes = new Set<string>(normalizedPartCodes(part));
  for (const oem of oemNumbersOf(part)) {
    const c = oem.trim().toLowerCase();
    if (c) codes.add(c);
  }
  for (const c of [...codes]) {
    const compact = c.replace(/[^a-z0-9]/g, "");
    if (compact.length >= 4) codes.add(compact);
  }
  return [...codes];
}

export function findDuplicatePart(
  parts: Part[],
  input: { partNumber: string; partNumbers?: string[] },
  ignoreId?: string,
): Part | undefined {
  const incoming = new Set(normalizedPartCodes(input));
  if (incoming.size === 0) return undefined;
  return parts.find((part) => {
    if (ignoreId && part.id === ignoreId) return false;
    if (isArchivedMergedPart(part)) return false;
    return normalizedPartCodes(part).some((code) => incoming.has(code));
  });
}

export function blendedUnitCost(
  onHand: number,
  currentCost: number,
  addQty: number,
  incomingCost: number,
): number {
  const have = Math.max(0, onHand);
  const add = Math.max(0, addQty);
  if (add <= 0) return Math.max(0, currentCost);
  const next = have + add;
  if (next <= 0) return Math.max(0, incomingCost);
  return Math.round(((have * currentCost + add * incomingCost) / next + Number.EPSILON) * 100) / 100;
}

/** Groups of 2+ parts that share part #, OEM, or compact cross-ref codes. */
export function findDuplicateGroups(parts: Part[]): Part[][] {
  const active = parts.filter((p) => !isArchivedMergedPart(p));
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p !== id) {
      const root = find(p);
      parent.set(id, root);
      return root;
    }
    return id;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  const byCode = new Map<string, string>();
  for (const part of active) {
    parent.set(part.id, part.id);
    for (const code of smartDuplicateCodes(part)) {
      if (code.length < 3) continue;
      const existing = byCode.get(code);
      if (existing) union(existing, part.id);
      else byCode.set(code, part.id);
    }
  }

  const groups = new Map<string, Part[]>();
  for (const part of active) {
    const root = find(part.id);
    const list = groups.get(root) ?? [];
    list.push(part);
    groups.set(root, list);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .sort((a, b) => b.length - a.length);
}

/** Fuzzy match kit machine label to a fleet make/model. */
export function kitMatchesMachine(
  kitMachine: string | undefined,
  make: string,
  model: string,
): boolean {
  const kit = (kitMachine ?? "").trim().toLowerCase();
  if (!kit) return false;
  const makeL = make.trim().toLowerCase();
  const modelL = model.trim().toLowerCase();
  const combo = `${makeL} ${modelL}`.trim();
  if (!combo) return false;
  if (kit.includes(combo) || combo.includes(kit)) return true;
  if (modelL && (kit.includes(modelL) || modelL.includes(kit))) return true;
  if (makeL && modelL && kit.includes(makeL) && kit.includes(modelL)) return true;
  return false;
}
