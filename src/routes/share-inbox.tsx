import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileImage, Inbox, Plus, Ship, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import {
  SHARE_KIND_LABELS,
  useShareInbox,
  type ShareInboxItem,
  type ShareItemKind,
} from "@/components/app/share-inbox-context";
import { useShipments } from "@/components/app/shipments-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compressImageToDataUrl } from "@/lib/image-compress";
import { takeSharedPending } from "@/lib/share-target";

export const Route = createFileRoute("/share-inbox")({
  head: () => ({
    meta: [
      { title: "Share inbox — Parts Village" },
      {
        name: "description",
        content: "Classify shared photos and PDFs: quotation, invoice, or China order paper.",
      },
    ],
  }),
  component: ShareInboxPage,
});

const KINDS: ShareItemKind[] = [
  "unassigned",
  "quotation",
  "invoice",
  "order-paper",
  "other",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function fileToInboxPayload(file: File | Blob, name: string) {
  const type = file.type || "application/octet-stream";
  if (type.startsWith("image/")) {
    const asFile =
      file instanceof File ? file : new File([file], name, { type });
    const dataUrl = await compressImageToDataUrl(asFile);
    return { name, dataUrl, mimeType: "image/jpeg" };
  }

  // PDF / other → data URL (cap ~1.2MB encoded)
  const buf = await file.arrayBuffer();
  if (buf.byteLength > 900_000) {
    throw new Error(`${name} is too large — compress or send a photo instead`);
  }
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  const dataUrl = `data:${type};base64,${b64}`;
  return { name, dataUrl, mimeType: type };
}

function ShareInboxPage() {
  const navigate = useNavigate();
  const { items, pendingCount, addItems, updateItem, removeItem } = useShareInbox();
  const { shipments, addShipment, addAttachment } = useShipments();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const importing = useRef(false);

  // Pull files from OS share (service worker stash)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("manual")) {
      toast.message("Open Share inbox once, then Share → Parts Village from photos");
      void navigate({ to: "/share-inbox", replace: true });
      return;
    }
    if (!params.has("received") && !params.has("error")) return;
    if (params.has("error")) {
      toast.error("Share failed — try Upload on this page");
      void navigate({ to: "/share-inbox", replace: true });
      return;
    }
    if (importing.current) return;
    importing.current = true;
    void (async () => {
      setBusy(true);
      try {
        const pending = await takeSharedPending();
        if (!pending || pending.files.length === 0) {
          toast.message("No shared files found — use Upload below");
          return;
        }
        const payloads = [];
        for (const f of pending.files) {
          payloads.push(await fileToInboxPayload(f.blob, f.name));
        }
        addItems(payloads);
        toast.success(`Received ${payloads.length} file${payloads.length === 1 ? "" : "s"} — choose type`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not import shared files");
      } finally {
        setBusy(false);
        importing.current = false;
        void navigate({ to: "/share-inbox", replace: true });
      }
    })();
  }, [addItems, navigate]);

  const onUpload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const payloads = [];
      for (const file of Array.from(list)) {
        payloads.push(await fileToInboxPayload(file, file.name));
      }
      addItems(payloads);
      toast.success(`Added ${payloads.length} to inbox`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const assignToShipment = (item: ShareInboxItem, shipmentId: string) => {
    if (item.kind === "unassigned") {
      toast.error("Choose what this file is first");
      return;
    }
    const kind =
      item.kind === "quotation"
        ? "quotation"
        : item.kind === "invoice"
          ? "invoice"
          : item.kind === "order-paper"
            ? "paper"
            : "other";

    const att = addAttachment(shipmentId, {
      name: item.name,
      dataUrl: item.dataUrl,
      kind,
    });
    if (!att) {
      toast.error("Could not attach to shipment");
      return;
    }
    updateItem(item.id, { shipmentId });
    toast.success("Attached to shipment");
  };

  const createShipmentAndAttach = (item: ShareInboxItem) => {
    if (item.kind === "unassigned") {
      toast.error("Choose what this file is first");
      return;
    }
    const title =
      item.kind === "quotation"
        ? `Quotation — ${item.name.replace(/\.[^.]+$/, "")}`
        : item.kind === "invoice"
          ? `Invoice — ${item.name.replace(/\.[^.]+$/, "")}`
          : `Order paper — ${item.name.replace(/\.[^.]+$/, "")}`;

    const ship = addShipment({
      title,
      supplier: "",
      orderedAt: todayIso(),
      status: "Ordered",
      currency: "USD",
      freightCurrency: "USD",
      notes: `From share inbox · ${SHARE_KIND_LABELS[item.kind]}`,
    });
    assignToShipment(item, ship.id);
  };

  const pending = items.filter((it) => it.kind === "unassigned" || !it.shipmentId);
  const done = items.filter((it) => it.shipmentId);

  return (
    <>
      <PageHeader
        title="Share inbox"
        subtitle={
          pendingCount
            ? `${pendingCount} waiting — choose quotation / invoice / order paper`
            : "Share photos & PDFs from your phone into Parts Village"
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Android:</strong> Share a photo/PDF → Parts
              Village (install the app to Home screen first).{" "}
              <strong className="text-foreground">iPhone / anywhere:</strong> open this page and
              tap Upload.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {busy ? "Working…" : "Upload photo / PDF"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => void onUpload(e.target.files)}
              />
            </div>
          </CardContent>
        </Card>

        {pending.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-40" />
            <p>Inbox is empty — share or upload a quotation / invoice / order paper.</p>
          </div>
        )}

        {pending.map((item) => (
          <InboxCard
            key={item.id}
            item={item}
            shipments={shipments}
            onKind={(kind) => updateItem(item.id, { kind })}
            onAssign={(shipmentId) => assignToShipment(item, shipmentId)}
            onNewShipment={() => createShipmentAndAttach(item)}
            onRemove={() => {
              removeItem(item.id);
              toast.message("Removed");
            }}
          />
        ))}

        {done.length > 0 && (
          <div className="space-y-2 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attached ({done.length})
            </p>
            {done.map((item) => (
              <Card key={item.id} className="opacity-80">
                <CardContent className="flex items-center gap-3 p-3">
                  <PreviewThumb item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SHARE_KIND_LABELS[item.kind]} · attached
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function PreviewThumb({ item }: { item: ShareInboxItem }) {
  if (item.mimeType.startsWith("image/") || item.dataUrl.startsWith("data:image/")) {
    return (
      <img
        src={item.dataUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-md object-cover border border-border"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
      <FileImage className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

function InboxCard({
  item,
  shipments,
  onKind,
  onAssign,
  onNewShipment,
  onRemove,
}: {
  item: ShareInboxItem;
  shipments: ReturnType<typeof useShipments>["shipments"];
  onKind: (k: ShareItemKind) => void;
  onAssign: (shipmentId: string) => void;
  onNewShipment: () => void;
  onRemove: () => void;
}) {
  const [assignValue, setAssignValue] = useState("");
  const sorted = [...shipments].sort((a, b) =>
    (b.orderedAt || b.createdAt).localeCompare(a.orderedAt || a.createdAt),
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-3">
          <PreviewThumb item={item} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold">{item.name}</p>
              {item.kind === "unassigned" ? (
                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800">
                  Needs type
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  {SHARE_KIND_LABELS[item.kind]}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleString()}
            </p>
            {(item.mimeType.startsWith("image/") ||
              item.dataUrl.startsWith("data:image/")) && (
              <a
                href={item.dataUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-accent underline"
              >
                Open preview
              </a>
            )}
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">What is this?</Label>
          <Select value={item.kind} onValueChange={(v) => onKind(v as ShareItemKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SHARE_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Put on shipment</Label>
          <Select
            value={assignValue || undefined}
            onValueChange={(v) => {
              setAssignValue("");
              if (v === "__new__") onNewShipment();
              else if (v) onAssign(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose shipment…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__new__">
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  New shipment
                </span>
              </SelectItem>
              {sorted.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-1.5">
                    <Ship className="h-3.5 w-3.5" />
                    {s.title}
                    {s.trackingNumber ? ` · ${s.trackingNumber}` : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
