import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Soft pill / chip surfaces — use for remaining balance, shipment status, etc. */
export const statusToneClass: Record<StatusTone, string> = {
  success: "border border-chart-4/30 bg-chart-4/10 text-foreground",
  warning: "border border-accent/30 bg-accent/10 text-foreground",
  danger: "border border-destructive/30 bg-destructive/10 text-foreground",
  info: "border border-primary/20 bg-primary/5 text-foreground",
  neutral: "border border-border bg-muted/50 text-muted-foreground",
};

export function statusChipClass(tone: StatusTone, className?: string) {
  return cn(
    "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold",
    statusToneClass[tone],
    className,
  );
}
