import { roundMoney } from "@/lib/document-money";

export type MoneyCurrency = "USD" | "RMB";

export function toUsd(amount: number, currency: MoneyCurrency, rmbPerUsd: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (currency === "USD") return roundMoney(amount);
  if (!Number.isFinite(rmbPerUsd) || rmbPerUsd <= 0) return 0;
  return roundMoney(amount / rmbPerUsd);
}

export function formatMoneyWithUsd(
  amount: number,
  currency: MoneyCurrency,
  rmbPerUsd: number,
): string {
  if (!Number.isFinite(amount)) return "—";
  if (currency === "USD") return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const usd = toUsd(amount, currency, rmbPerUsd);
  return `¥${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} (~$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })})`;
}
