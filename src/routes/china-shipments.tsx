import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ChevronRight, Copy, ExternalLink, FileImage, Plus, Ship, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { ShipmentFormDialog } from "@/components/app/shipment-form-dialog";
import {
  useShipments,
  type ChinaShipment,
  type ShipmentAttachment,
  type ShipmentStatus,
} from "@/components/app/shipments-context";
import { useSearch } from "@/components/app/search-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compressImageToDataUrl } from "@/lib/image-compress";
import { cn } from "@/lib/utils";

const TITUS_PORTAL = "https://login.titus-logistics.com/index.php?lang=en_us";
const TITUS_MOBILE = "https://login.titus-logistics.com/mobile/index.php";

export const Route = createFileRoute("/china-shipments")({
  head: () => ({
    meta: [
      { title: "China shipments — Parts Village" },
      {
        name: "description",
        content: "Track China orders: dates, tracking, costs, and invoice photos.",
      },
    ],
  }),
  component: ChinaShipmentsPage,
});

const STATUS_STYLE: Record<ShipmentStatus, string> = {
  Ordered: "border-slate-300 text-slate-700",
  "In transit": "border-sky-400 text-sky-800 bg-sky-50",
  Arrived: "border-amber-400 text-amber-900 bg-amber-50",
  "In stock": "border-emerald-500 text-emerald-800 bg-emerald-50",
  Cancelled: "border-rose-300 text-rose-700 bg-rose-50",
};

function ChinaShipmentsPage() {
  const { query } = useSearch();
  const { shipments, removeShipment } = useShipments();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChinaShipment | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    const sorted = [...shipments].sort((a, b) =>
      (b.orderedAt || b.createdAt).localeCompare(a.orderedAt || a.createdAt),
    );
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.supplier.toLowerCase().includes(q) ||
        (s.trackingNumber ?? "").toLowerCase().includes(q) ||
        (s.titusLocation ?? "").toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q) ||
        (s.freightMode ?? "").toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q),
    );
  }, [shipments, q]);

  const detail = detailId ? shipments.find((s) => s.id === detailId) ?? null : null;

  return (
    <>
      <PageHeader
        title="China shipments"
        subtitle={`${rows.length} of ${shipments.length} · Titus tracking + papers`}
      />
      <main className="flex-1 space-y-3 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(TITUS_PORTAL, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Titus account
          </Button>
          <Button
            type="button"
            className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New shipment
          </Button>
        </div>

        {rows.map((s) => (
          <Card
            key={s.id}
            className="cursor-pointer transition hover:border-accent/60 hover:shadow-md"
            onClick={() => setDetailId(s.id)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Ship className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-foreground">{s.title}</h3>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[s.status])}>
                    {s.status}
                  </Badge>
                  {(s.attachments?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <FileImage className="h-3 w-3" />
                      {s.attachments.length}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {[
                    s.supplier || null,
                    s.trackingNumber ? `Titus ${s.trackingNumber}` : null,
                    s.titusLocation || null,
                    s.orderedAt ? `Ordered ${s.orderedAt}` : null,
                    s.freightMode || null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Open to add Titus #, cost & photos"}
                </p>
              </div>
              <div className="hidden text-right md:block">
                {s.totalCost != null ? (
                  <>
                    <p className="text-sm font-semibold">
                      {s.currency === "RMB" ? "¥" : "$"}
                      {s.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.currency}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No cost set</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}

        {rows.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {q
              ? `No shipments match “${query}”.`
              : "No China shipments yet — add one when you place an order."}
          </div>
        )}
      </main>

      <ShipmentFormDialog
        open={formOpen}
        shipment={editing}
        onOpenChange={setFormOpen}
        onCreated={(id) => setDetailId(id)}
      />

      <ShipmentDetailDialog
        shipment={detail}
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onEdit={() => {
          if (!detail) return;
          setEditing(detail);
          setFormOpen(true);
        }}
        onDelete={() => {
          if (!detail) return;
          if (!confirm(`Delete shipment “${detail.title}”?`)) return;
          removeShipment(detail.id);
          setDetailId(null);
          toast.success("Shipment deleted");
        }}
      />
    </>
  );
}

function ShipmentDetailDialog({
  shipment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  shipment: ChinaShipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { updateShipment, addAttachment, removeAttachment } = useShipments();
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<ShipmentAttachment | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const paperInputRef = useRef<HTMLInputElement>(null);

  if (!shipment) return null;

  const onUpload = async (files: FileList | null, kind: ShipmentAttachment["kind"]) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        const dataUrl = await compressImageToDataUrl(file);
        addAttachment(shipment.id, { name: file.name, dataUrl, kind });
      }
      toast.success("Photo attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
            <DialogTitle className="pr-8">{shipment.title}</DialogTitle>
            <DialogDescription>
              {[shipment.supplier, shipment.status].filter(Boolean).join(" · ") ||
                "Shipment details"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={shipment.status}
                onValueChange={(v) =>
                  updateShipment(shipment.id, { status: v as ShipmentStatus })
                }
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_STYLE) as ShipmentStatus[]).map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Titus Logistics
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {shipment.trackingNumber && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(shipment.trackingNumber!);
                        toast.success("Titus # copied");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copy #
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 gap-1 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() =>
                      window.open(TITUS_PORTAL, "_blank", "noopener,noreferrer")
                    }
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Titus
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() =>
                      window.open(TITUS_MOBILE, "_blank", "noopener,noreferrer")
                    }
                  >
                    Mobile login
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Live location & bills stay in your Titus account — paste the shipment # and costs
                here so Parts Village keeps your own record.
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Meta label="Titus #" value={shipment.trackingNumber || "—"} mono />
                <Meta label="Mode" value={shipment.freightMode || "—"} />
                <Meta
                  label="Freight"
                  value={
                    shipment.freightCost != null
                      ? `${shipment.freightCurrency === "RMB" ? "¥" : "$"}${shipment.freightCost}`
                      : "—"
                  }
                />
                <Meta
                  label="Size"
                  value={
                    [
                      shipment.cartons != null ? `${shipment.cartons} ctns` : null,
                      shipment.weightKg != null ? `${shipment.weightKg} kg` : null,
                      shipment.volumeCbm != null ? `${shipment.volumeCbm} CBM` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
              </dl>
              {shipment.titusLocation?.trim() && (
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Where now
                  </p>
                  <p className="text-sm font-medium">{shipment.titusLocation}</p>
                </div>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Ordered" value={shipment.orderedAt || "—"} />
              <Meta label="Expected" value={shipment.expectedAt || "—"} />
              <Meta label="Arrived" value={shipment.arrivedAt || "—"} />
              <Meta label="Supplier" value={shipment.supplier || "—"} />
              <Meta
                label="Goods cost"
                value={
                  shipment.totalCost != null
                    ? `${shipment.currency === "RMB" ? "¥" : "$"}${shipment.totalCost}`
                    : "—"
                }
              />
            </dl>

            {shipment.notes?.trim() && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-foreground">{shipment.notes}</p>
              </div>
            )}

            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">Papers & invoices</h4>
                <p className="text-xs text-muted-foreground">
                  Upload the China invoice or a photo of a handwritten paper
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={invoiceInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void onUpload(e.target.files, "invoice");
                    e.target.value = "";
                  }}
                />
                <input
                  ref={paperInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void onUpload(e.target.files, "paper");
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={uploading}
                  onClick={() => invoiceInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : "Invoice photo"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={uploading}
                  onClick={() => paperInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Written paper
                </Button>
              </div>

              {(shipment.attachments?.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No photos yet — attach the supplier invoice or your notes.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shipment.attachments.map((a) => (
                    <div
                      key={a.id}
                      className="overflow-hidden rounded-md border border-border"
                    >
                      <button
                        type="button"
                        className="block w-full"
                        onClick={() => setViewer(a)}
                      >
                        <img
                          src={a.dataUrl}
                          alt={a.name}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      </button>
                      <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-medium uppercase text-muted-foreground">
                            {a.kind}
                          </p>
                          <p className="truncate text-[11px]">{a.name}</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            removeAttachment(shipment.id, a.id);
                            toast.message("Photo removed");
                          }}
                          aria-label="Remove photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t border-border px-6 py-3">
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                type="button"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={onEdit}
              >
                Edit details
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewer)} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl p-2 sm:p-3">
          <DialogHeader className="px-2 pt-1">
            <DialogTitle className="text-sm">{viewer?.name}</DialogTitle>
            <DialogDescription className="capitalize">{viewer?.kind}</DialogDescription>
          </DialogHeader>
          {viewer && (
            <img
              src={viewer.dataUrl}
              alt={viewer.name}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-sm font-medium", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
