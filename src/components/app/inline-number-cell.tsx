import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onCommit: (next: number) => void;
  className?: string;
  /** Allow decimals (cost/price). */
  decimal?: boolean;
  align?: "left" | "right";
};

/** Click-to-edit number for inventory qty / cost / price. */
export function InlineNumberCell({
  value,
  onCommit,
  className,
  decimal,
  align = "right",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(value === 0 && !decimal ? "0" : String(value));
  }, [value, editing, decimal]);

  const commit = () => {
    const n = decimal ? Number.parseFloat(draft) : Number.parseInt(draft, 10);
    setEditing(false);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(value));
      return;
    }
    const next = decimal ? Math.round(n * 100) / 100 : Math.floor(n);
    if (next !== value) onCommit(next);
  };

  if (!editing) {
    return (
      <button
        type="button"
        title="Click to edit"
        className={cn(
          "w-full rounded px-1 py-0.5 font-mono text-xs hover:bg-muted/80",
          align === "right" ? "text-right" : "text-left",
          className,
        )}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {decimal
          ? value > 0
            ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : "—"
          : value.toLocaleString()}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      type="number"
      min={0}
      step={decimal ? "0.01" : "1"}
      inputMode={decimal ? "decimal" : "numeric"}
      className={cn(
        "h-8 px-1 font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        align === "right" && "text-right",
        className,
      )}
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(String(value));
          setEditing(false);
        }
      }}
    />
  );
}
