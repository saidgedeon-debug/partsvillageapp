import { useMemo, useState } from "react";
import { PackagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { useKits } from "@/components/app/kits-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { partNumbersOf } from "@/lib/mock-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KitsDialog({ open, onOpenChange }: Props) {
  const { kits, addKit, removeKit } = useKits();
  const { parts, getPart } = useInventory();
  const { lines, addPart, documentKind, setDocumentKind, setCartOpen } = useCart();
  const [name, setName] = useState("");
  const [machine, setMachine] = useState("");
  const [codes, setCodes] = useState("");
  const [filter, setFilter] = useState("");

  const index = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of parts) {
      for (const code of partNumbersOf(p)) {
        map.set(code.trim().toLowerCase(), p.id);
      }
    }
    return map;
  }, [parts]);

  const filteredKits = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return kits;
    return kits.filter((kit) => {
      const labels = kit.lines
        .map((line) => getPart(line.partId)?.partNumber ?? "")
        .join(" ");
      return `${kit.name} ${kit.machine ?? ""} ${labels}`.toLowerCase().includes(q);
    });
  }, [kits, filter, getPart]);

  const create = () => {
    if (!name.trim()) {
      toast.error("Enter a kit name");
      return;
    }
    const kitLines: Array<{ partId: string; qty: number }> = [];
    for (const raw of codes.split(/[\n,;]+/)) {
      const match = raw.trim().match(/^(.+?)(?:\s*[x×*]\s*(\d+))?$/i);
      const code = (match?.[1] ?? "").trim().toLowerCase();
      if (!code) continue;
      const id = index.get(code);
      if (id) {
        const qty = Math.max(1, Math.round(Number(match?.[2]) || 1));
        const existing = kitLines.find((line) => line.partId === id);
        if (existing) existing.qty += qty;
        else kitLines.push({ partId: id, qty });
      }
    }
    if (kitLines.length === 0) {
      toast.error("Add at least one valid part code");
      return;
    }
    addKit({ name: name.trim(), machine: machine.trim() || undefined, lines: kitLines });
    toast.success(`Saved kit “${name.trim()}” (${kitLines.length} parts)`);
    setName("");
    setMachine("");
    setCodes("");
  };

  const saveFromCart = () => {
    if (!name.trim()) {
      toast.error("Enter a kit name first");
      return;
    }
    const kitLines = lines
      .filter((line) => line.partId && line.category !== "Payment" && line.category !== "Discount")
      .map((line) => ({
        partId: line.partId,
        qty: Math.max(1, Math.round(line.qty) || 1),
      }));
    if (kitLines.length === 0) {
      toast.error("Cart is empty — add parts first");
      return;
    }
    addKit({ name: name.trim(), machine: machine.trim() || undefined, lines: kitLines });
    toast.success(`Saved kit “${name.trim()}” from cart (${kitLines.length} parts)`);
    setName("");
    setMachine("");
    setCodes("");
  };

  const addKitToCart = (kitId: string) => {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    if (!documentKind) setDocumentKind("quotation");
    let n = 0;
    for (const line of kit.lines) {
      const p = getPart(line.partId);
      if (p) {
        addPart(p, line.qty);
        n += 1;
      }
    }
    setCartOpen(true);
    toast.success(`Added ${n} parts from “${kit.name}” to cart`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Machine kits
          </DialogTitle>
          <DialogDescription>
            Save usual parts for a common job or machine, then add the whole kit to the cart in one
            click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label>Kit name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PC200-7 seal kit"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Machine / job (optional)</Label>
            <Input
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              placeholder="Komatsu PC200-7 · boom cylinder"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Part codes (one per line)</Label>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              placeholder={"A01-1 x2\nA01-2\nA03-12 x4"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={create}>
              Save kit
            </Button>
            <Button type="button" variant="outline" onClick={saveFromCart}>
              Save from cart ({lines.length})
            </Button>
          </div>
        </div>

        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter kits by name, machine, or part…"
        />

        <div className="space-y-2">
          {filteredKits.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {kits.length === 0 ? "No kits yet." : "No kits match that filter."}
            </p>
          )}
          {filteredKits.map((kit) => (
            <div
              key={kit.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{kit.name}</p>
                {kit.machine ? (
                  <p className="text-xs text-muted-foreground">{kit.machine}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="secondary">{kit.lines.length} parts</Badge>
                  {kit.lines.slice(0, 4).map((line) => {
                    const p = getPart(line.partId);
                    return p ? (
                      <Badge key={line.partId} variant="outline" className="font-mono text-[10px]">
                        {p.partNumber} ×{line.qty}
                      </Badge>
                    ) : null;
                  })}
                  {kit.lines.length > 4 ? (
                    <Badge variant="outline" className="text-[10px]">
                      +{kit.lines.length - 4}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button type="button" size="sm" onClick={() => addKitToCart(kit.id)}>
                  Add to cart
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() => {
                    removeKit(kit.id);
                    toast.message("Kit removed");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
