import { useMemo } from "react";
import { ClipboardCopy, FileText } from "lucide-react";
import { toast } from "sonner";

import { usePreOrders } from "@/components/app/preorders-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildSupplierOrderList, supplierOrderListText } from "@/lib/preorders";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupplierOrderListDialog({ open, onOpenChange }: Props) {
  const { orders } = usePreOrders();
  const items = useMemo(() => buildSupplierOrderList(orders), [orders]);
  const text = useMemo(() => supplierOrderListText(items), [items]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Supplier list copied — paste into WhatsApp or Email");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-order-list-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Text file downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Supplier order list</DialogTitle>
          <DialogDescription>
            Anonymous list of parts still needed from abroad — part number, name, and quantity
            only. No customer names, prices, or dates.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No open procurement items.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Part #</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.partNumber}-${item.name}`} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs font-semibold">{item.partNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.name}</td>
                    <td className="px-3 py-2 text-right font-semibold">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="outline" className="gap-1.5" disabled={!items.length} onClick={download}>
            <FileText className="h-3.5 w-3.5" />
            Export as Text
          </Button>
          <Button type="button" className="gap-1.5" disabled={!items.length} onClick={() => void copy()}>
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy to clipboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
