import { useState } from "react";
import { Merge } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import { confirmAction } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { findDuplicateGroups } from "@/lib/part-identity";
import { currency } from "@/lib/mock-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MergeDuplicatesDialog({ open, onOpenChange }: Props) {
  const { parts, mergeParts } = useInventory();
  const groups = findDuplicateGroups(parts);
  const [busyId, setBusyId] = useState<string | null>(null);

  const mergeGroup = async (keepId: string, absorbIds: string[]) => {
    const ok = await confirmAction({
      title: "Merge these duplicates?",
      description:
        "Stock and cost are blended into the kept part. Absorbed custom parts are removed; catalog duplicates are zeroed and marked merged.",
      confirmLabel: "Merge",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(keepId);
    try {
      const result = mergeParts(keepId, absorbIds);
      toast.success(
        `Merged into ${result.kept.partNumber} · qty ${result.kept.quantity} · cost ${currency(result.kept.cost)}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge duplicate parts
          </DialogTitle>
          <DialogDescription>
            Parts that share a part or OEM number. Keep one row; stock and cost blend in.
          </DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No duplicate groups found.</p>
        ) : (
          <div className="space-y-3">
            {groups.slice(0, 40).map((group) => {
              const sorted = [...group].sort((a, b) => b.quantity - a.quantity);
              const keep = sorted[0]!;
              const absorb = sorted.slice(1);
              return (
                <div key={keep.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {sorted.map((p) => (
                      <Badge key={p.id} variant={p.id === keep.id ? "default" : "outline"}>
                        {p.partNumber} · qty {p.quantity}
                      </Badge>
                    ))}
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Keep <span className="font-mono font-semibold">{keep.partNumber}</span> (
                    {keep.name})
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === keep.id}
                    onClick={() => void mergeGroup(keep.id, absorb.map((p) => p.id))}
                  >
                    Merge into {keep.partNumber}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
