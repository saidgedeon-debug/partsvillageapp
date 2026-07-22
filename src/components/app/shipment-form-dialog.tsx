import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useShipments,
  type ChinaShipment,
  type ShipmentInput,
  type ShipmentStatus,
} from "@/components/app/shipments-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUSES: ShipmentStatus[] = [
  "Ordered",
  "In transit",
  "Arrived",
  "In stock",
  "Cancelled",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment?: ChinaShipment | null;
  onCreated?: (id: string) => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ShipmentFormDialog({ open, onOpenChange, shipment, onCreated }: Props) {
  const { addShipment, updateShipment } = useShipments();
  const isEdit = Boolean(shipment?.id);

  const [title, setTitle] = useState("");
  const [supplier, setSupplier] = useState("");
  const [orderedAt, setOrderedAt] = useState(todayIso());
  const [expectedAt, setExpectedAt] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("Ordered");
  const [notes, setNotes] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [currency, setCurrency] = useState<"USD" | "RMB">("USD");

  useEffect(() => {
    if (!open) return;
    if (shipment) {
      setTitle(shipment.title);
      setSupplier(shipment.supplier);
      setOrderedAt(shipment.orderedAt);
      setExpectedAt(shipment.expectedAt ?? "");
      setArrivedAt(shipment.arrivedAt ?? "");
      setTrackingNumber(shipment.trackingNumber ?? "");
      setStatus(shipment.status);
      setNotes(shipment.notes ?? "");
      setTotalCost(
        shipment.totalCost != null && Number.isFinite(shipment.totalCost)
          ? String(shipment.totalCost)
          : "",
      );
      setCurrency(shipment.currency);
      return;
    }
    setTitle("");
    setSupplier("");
    setOrderedAt(todayIso());
    setExpectedAt("");
    setArrivedAt("");
    setTrackingNumber("");
    setStatus("Ordered");
    setNotes("");
    setTotalCost("");
    setCurrency("USD");
  }, [open, shipment]);

  const save = () => {
    if (!title.trim()) {
      toast.error("Give the shipment a name");
      return;
    }
    const costRaw = totalCost.trim() === "" ? undefined : Number(totalCost);
    const input: ShipmentInput = {
      title: title.trim(),
      supplier,
      orderedAt,
      expectedAt: expectedAt || undefined,
      arrivedAt: arrivedAt || undefined,
      trackingNumber,
      status,
      notes,
      totalCost: costRaw,
      currency,
    };

    if (isEdit && shipment) {
      updateShipment(shipment.id, input);
      toast.success("Shipment updated");
      onOpenChange(false);
      return;
    }

    const created = addShipment(input);
    toast.success("Shipment added");
    onOpenChange(false);
    onCreated?.(created.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit shipment" : "New China shipment"}</DialogTitle>
          <DialogDescription>
            Track orders from China — dates, tracking, cost, then attach invoice photos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ship-title">Name</Label>
            <Input
              id="ship-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. July O-rings order"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ship-supplier">Supplier / factory</Label>
            <Input
              id="ship-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ship-ordered">Ordered</Label>
              <Input
                id="ship-ordered"
                type="date"
                value={orderedAt}
                onChange={(e) => setOrderedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship-expected">Expected</Label>
              <Input
                id="ship-expected"
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ship-arrived">Arrived</Label>
              <Input
                id="ship-arrived"
                type="date"
                value={arrivedAt}
                onChange={(e) => setArrivedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ship-track">Tracking #</Label>
            <Input
              id="ship-track"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Optional"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-[1fr_6.5rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ship-cost">Total cost</Label>
              <Input
                id="ship-cost"
                type="number"
                min={0}
                step={0.01}
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as "USD" | "RMB")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="RMB">RMB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ship-notes">Notes</Label>
            <Textarea
              id="ship-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What’s inside, packing notes, WeChat contact…"
              className="min-h-[72px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={save}
          >
            {isEdit ? "Save" : "Add shipment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
