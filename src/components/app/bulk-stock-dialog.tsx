import { useMemo, useState } from "react";
import { TableProperties } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { oemNumbersOf } from "@/lib/mock-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Paste lines: PartCode | Qty | Cost | Price
 * Separators: tab, |, or comma. Cost/Price optional.
 */
export function BulkStockDialog({ open, onOpenChange }: Props) {
  const { parts, bulkUpdateParts } = useInventory();
  const [text, setText] = useState("");

  const index = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of parts) {
      map.set(p.partNumber.trim().toLowerCase(), p.id);
      for (const oem of oemNumbersOf(p)) {
        map.set(oem.trim().toLowerCase(), p.id);
      }
    }
    return map;
  }, [parts]);

  const apply = () => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const updates: { id: string; quantity?: number; cost?: number; price?: number }[] =
      [];
    let skipped = 0;

    for (const line of lines) {
      const cols = line.split(/[\t|,;]+/).map((c) => c.trim());
      if (cols.length < 2) {
        skipped += 1;
        continue;
      }
      const code = cols[0].toLowerCase();
      const id = index.get(code);
      if (!id) {
        skipped += 1;
        continue;
      }
      const quantity = cols[1] !== "" ? Number(cols[1]) : undefined;
      const cost = cols[2] !== undefined && cols[2] !== "" ? Number(cols[2]) : undefined;
      const price = cols[3] !== undefined && cols[3] !== "" ? Number(cols[3]) : undefined;
      if (
        (quantity !== undefined && !Number.isFinite(quantity)) ||
        (cost !== undefined && !Number.isFinite(cost)) ||
        (price !== undefined && !Number.isFinite(price))
      ) {
        skipped += 1;
        continue;
      }
      updates.push({ id, quantity, cost, price });
    }

    const n = bulkUpdateParts(updates);
    if (n === 0) {
      toast.error("No rows updated — check part codes");
      return;
    }
    toast.success(`Updated ${n} part${n === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`);
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableProperties className="h-5 w-5" />
            Bulk stock & prices
          </DialogTitle>
          <DialogDescription>
            Paste one part per line:{" "}
            <span className="font-mono text-foreground">PartCode | Qty | Cost | Price</span>
            . Cost and price are optional. Codes match catalog or OEM numbers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bulk-stock">Rows</Label>
          <Textarea
            id="bulk-stock"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"A01-1\t10\t12.5\t25\nA01-2 | 5 | 8 | 18\n701/80184, 20"}
            className="min-h-[200px] font-mono text-xs"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={apply} disabled={!text.trim()}>
            Apply updates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
