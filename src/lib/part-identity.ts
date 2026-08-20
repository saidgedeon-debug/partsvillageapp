import { partNumbersOf, type Part } from "@/lib/mock-data";

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

export function findDuplicatePart(
  parts: Part[],
  input: { partNumber: string; partNumbers?: string[] },
  ignoreId?: string,
): Part | undefined {
  const incoming = new Set(normalizedPartCodes(input));
  if (incoming.size === 0) return undefined;
  return parts.find((part) => {
    if (ignoreId && part.id === ignoreId) return false;
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
