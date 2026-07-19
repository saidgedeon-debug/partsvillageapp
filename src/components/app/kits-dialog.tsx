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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KitsDialog({ open, onOpenChange }: Props) {
  const { kits, addKit, removeKit } = useKits();
  const { parts, getPart } = useInventory();
  const { addPart, documentKind, setDocumentKind, setCartOpen } = useCart();
  const [name, setName] = useState("");
  const [machine, setMachine] = useState("");
  const [codes, setCodes] = useState("");

  const index = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of parts) map.set(p.partNumber.trim().toLowerCase(), p.id);
    return map;
  }, [parts]);

  const create = () => {
    if (!name.trim()) {
      toast.error("Enter a kit name");
      return;
    }
    const partIds: string[] = [];
    for (const raw of codes.split(/[\n,;]+/)) {
      const code = raw.trim().toLowerCase();
      if (!code) continue;
      const id = index.get(code);
      if (id) partIds.push(id);
    }
    if (partIds.length === 0) {
      toast.error("Add at least one valid part code");
      return;
    }
    addKit({ name: name.trim(), machine: machine.trim() || undefined, partIds });
    toast.success(`Saved kit “${name.trim()}” (${partIds.length} parts)`);
    setName("");
    setMachine("");
    setCodes("");
  };

  const addKitToCart = (kitId: string) => {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    if (!documentKind) setDocumentKind("quotation");
    let n = 0;
    for (const id of kit.partIds) {
      const p = getPart(id);
      if (p) {
        addPart(p, 1);
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
            Save usual parts for a machine, then add the whole kit to the cart in one click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label>Kit name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PC200-7 common sensors"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Machine (optional)</Label>
            <Input
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              placeholder="Komatsu PC200-7"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Part codes (one per line)</Label>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              placeholder={"A01-1\nA01-2\nA03-12"}
            />
          </div>
          <Button type="button" onClick={create}>
            Save kit
          </Button>
        </div>

        <div className="space-y-2">
          {kits.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No kits yet.</p>
          )}
          {kits.map((kit) => (
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
                  <Badge variant="secondary">{kit.partIds.length} parts</Badge>
                  {kit.partIds.slice(0, 4).map((id) => {
                    const p = getPart(id);
                    return p ? (
                      <Badge key={id} variant="outline" className="font-mono text-[10px]">
                        {p.partNumber}
                      </Badge>
                    ) : null;
                  })}
                  {kit.partIds.length > 4 ? (
                    <Badge variant="outline" className="text-[10px]">
                      +{kit.partIds.length - 4}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
