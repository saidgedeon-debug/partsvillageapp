/** Daily sales digest for WhatsApp / SMS-style share. */

import type { DrawerExpected } from "@/lib/drawer-radar";
import { currency } from "@/lib/mock-data";
import { normalizePhoneE164 } from "@/lib/phone";

export function buildDailyDigestText(
  expected: DrawerExpected,
  opts?: { invoiceCount?: number; note?: string },
): string {
  const total = expected.cash + expected.omt + expected.whish;
  const lines = [
    `Parts Village — daily sales ${expected.date}`,
    "",
    `Cash: ${currency(expected.cash)}`,
    `OMT: ${currency(expected.omt)}`,
    `Whish: ${currency(expected.whish)}`,
    `Total: ${currency(total)}`,
    `${expected.receiptCount} cash-drawer receipt${expected.receiptCount === 1 ? "" : "s"}`,
  ];
  if (opts?.invoiceCount != null) {
    lines.push(`${opts.invoiceCount} invoice${opts.invoiceCount === 1 ? "" : "s"} dated today`);
  }
  if (opts?.note?.trim()) {
    lines.push("", opts.note.trim());
  }
  lines.push("", "— sent from Parts Village");
  return lines.join("\n");
}

export function openDailyDigestWhatsApp(
  phone: string | undefined,
  text: string,
): void {
  const digits = normalizePhoneE164(phone ?? "") ?? "";
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
