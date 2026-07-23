import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useShipments,
  getShipmentCategory,
  getShipmentCargoType,
  type ChinaShipment,
  type ShipmentCargoType,
  type ShipmentCategory,
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

const FREIGHT_MODES: NonNullable<ChinaShipment["freightMode"]>[] = [
  "Air",
  "Sea LCL",
  "Sea FCL",
  "Other",
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

function parseOptNumber(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
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
  const [category, setCategory] = useState<ShipmentCategory>("other");
  const [cargoType, setCargoType] = useState<ShipmentCargoType>("divers");
  const [notes, setNotes] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [currency, setCurrency] = useState<"USD" | "RMB">("USD");
  const [freightMode, setFreightMode] = useState<ChinaShipment["freightMode"]>("Air");
  const [freightCost, setFreightCost] = useState("");
  const [freightCurrency, setFreightCurrency] = useState<"USD" | "RMB">("USD");
  const [weightKg, setWeightKg] = useState("");
  const [volumeCbm, setVolumeCbm] = useState("");
  const [cartons, setCartons] = useState("");
  const [titusLocation, setTitusLocation] = useState("");
  const [titusStatus, setTitusStatus] = useState("");
  const [containerNo, setContainerNo] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");

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
      setCategory(getShipmentCategory(shipment));
      setCargoType(getShipmentCargoType(shipment));
      setNotes(shipment.notes ?? "");
      setTotalCost(
        shipment.totalCost != null && Number.isFinite(shipment.totalCost)
          ? String(shipment.totalCost)
          : "",
      );
      setCurrency(shipment.currency);
      setFreightMode(shipment.freightMode ?? "Air");
      setFreightCost(
        shipment.freightCost != null && Number.isFinite(shipment.freightCost)
          ? String(shipment.freightCost)
          : "",
      );
      setFreightCurrency(shipment.freightCurrency ?? "USD");
      setWeightKg(
        shipment.weightKg != null && Number.isFinite(shipment.weightKg)
          ? String(shipment.weightKg)
          : "",
      );
      setVolumeCbm(
        shipment.volumeCbm != null && Number.isFinite(shipment.volumeCbm)
          ? String(shipment.volumeCbm)
          : "",
      );
      setCartons(
        shipment.cartons != null && Number.isFinite(shipment.cartons)
          ? String(shipment.cartons)
          : "",
      );
      setTitusLocation(shipment.titusLocation ?? "");
      setTitusStatus(shipment.titusStatus ?? "");
      setContainerNo(shipment.containerNo ?? "");
      setEtd(shipment.etd ?? "");
      setEta(shipment.eta ?? shipment.expectedAt ?? "");
      return;
    }
    setTitle("");
    setSupplier("");
    setOrderedAt(todayIso());
    setExpectedAt("");
    setArrivedAt("");
    setTrackingNumber("");
    setStatus("Ordered");
    setCategory("other");
    setCargoType("divers");
    setNotes("");
    setTotalCost("");
    setCurrency("USD");
    setFreightMode("Air");
    setFreightCost("");
    setFreightCurrency("USD");
    setWeightKg("");
    setVolumeCbm("");
    setCartons("");
    setTitusLocation("");
    setTitusStatus("");
    setContainerNo("");
    setEtd("");
    setEta("");
  }, [open, shipment]);

  const save = () => {
    if (!title.trim()) {
      toast.error("Give the shipment a name");
      return;
    }
    const input: ShipmentInput = {
      title: title.trim(),
      supplier,
      orderedAt,
      expectedAt: eta || expectedAt || undefined,
      arrivedAt: arrivedAt || undefined,
      trackingNumber,
      status,
      category,
      cargoType,
      notes,
      totalCost: parseOptNumber(totalCost),
      currency,
      freightMode,
      freightCost: parseOptNumber(freightCost),
      freightCurrency,
      weightKg: parseOptNumber(weightKg),
      volumeCbm: parseOptNumber(volumeCbm),
      cartons: parseOptNumber(cartons),
      titusLocation,
      titusStatus: titusStatus || undefined,
      containerNo: containerNo || undefined,
      etd: etd || undefined,
      eta: eta || undefined,
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
          <DialogTitle>{isEdit ? "Edit shipment" : "New shipment"}</DialogTitle>
          <DialogDescription>
            Save Titus shipment #, freight cost, and where it is — open Titus app for live tracking.
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
              <Label>Type</Label>
              <Select
                value={cargoType}
                onValueChange={(v) => setCargoType(v as ShipmentCargoType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="divers">Divers</SelectItem>
                  <SelectItem value="heavy">Heavy equipment</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ShipmentCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="titus">Titus</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label htmlFor="ship-arrived">Arrived</Label>
              <Input
                id="ship-arrived"
                type="date"
                value={arrivedAt}
                onChange={(e) => setArrivedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Titus Logistics
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ship-track">Titus order #</Label>
              <Input
                id="ship-track"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. GA2607152046"
                className="font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-titus-status">Titus status</Label>
                <Input
                  id="ship-titus-status"
                  value={titusStatus}
                  onChange={(e) => setTitusStatus(e.target.value)}
                  placeholder="Planned / Loaded…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-container">Container</Label>
                <Input
                  id="ship-container"
                  value={containerNo}
                  onChange={(e) => setContainerNo(e.target.value)}
                  placeholder="e.g. AIR6068"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-etd">ETD</Label>
                <Input
                  id="ship-etd"
                  type="date"
                  value={etd}
                  onChange={(e) => setEtd(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-eta">ETA</Label>
                <Input
                  id="ship-eta"
                  type="date"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select
                  value={freightMode ?? "Air"}
                  onValueChange={(v) => setFreightMode(v as ChinaShipment["freightMode"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREIGHT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-cartons">Cartons</Label>
                <Input
                  id="ship-cartons"
                  type="number"
                  min={0}
                  step={1}
                  value={cartons}
                  onChange={(e) => setCartons(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-kg">Weight (kg)</Label>
                <Input
                  id="ship-kg"
                  type="number"
                  min={0}
                  step={0.01}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-cbm">Volume (CBM)</Label>
                <Input
                  id="ship-cbm"
                  type="number"
                  min={0}
                  step={0.001}
                  value={volumeCbm}
                  onChange={(e) => setVolumeCbm(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-freight">Freight cost (Titus)</Label>
                <Input
                  id="ship-freight"
                  type="number"
                  min={0}
                  step={0.01}
                  value={freightCost}
                  onChange={(e) => setFreightCost(e.target.value)}
                  placeholder="Shipping fee"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select
                  value={freightCurrency}
                  onValueChange={(v) => setFreightCurrency(v as "USD" | "RMB")}
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
              <Label htmlFor="ship-titus-loc">Where is it now? (from Titus)</Label>
              <Input
                id="ship-titus-loc"
                value={titusLocation}
                onChange={(e) => setTitusLocation(e.target.value)}
                placeholder="e.g. Guangzhou warehouse · on vessel · Beirut customs"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_6.5rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ship-cost">Goods cost</Label>
              <Input
                id="ship-cost"
                type="number"
                min={0}
                step={0.01}
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="Parts / factory invoice"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "RMB")}>
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
