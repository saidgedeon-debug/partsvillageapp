import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, ClipboardList, Plus, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { PartDetailDialog } from "@/components/app/part-detail-dialog";
import { PartScanDialog } from "@/components/app/part-scan-dialog";
import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { compressImageToDataUrl } from "@/lib/image-compress";
import { oemNumbersOf, partDescriptionOf, type Part } from "@/lib/mock-data";

export const Route = createFileRoute("/stock-take")({
  head: () => ({
    meta: [
      { title: "Stock take — Parts Village" },
      { name: "description", content: "Count or receive stock by part code." },
    ],
  }),
  component: StockTakePage,
});

type Mode = "set" | "receive" | "photo";

type LogEntry = {
  id: string;
  partNumber: string;
  before: number;
  after: number;
  mode: Mode;
};

function StockTakePage() {
  const { parts, updatePart, adjustPartQuantity, catalogReady } = useInventory();
  const [mode, setMode] = useState<Mode>("set");
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [createPrefill, setCreatePrefill] = useState<{
    partNumber?: string;
    quantity?: string;
  }>({});

  const openCreate = () => {
    setCreatePrefill({
      partNumber: code.trim() || undefined,
      quantity: qty.trim() || undefined,
    });
    setCreateOpen(true);
  };

  const index = useMemo(() => {
    const map = new Map<string, (typeof parts)[0]>();
    for (const p of parts) {
      map.set(p.partNumber.trim().toLowerCase(), p);
      for (const oem of oemNumbersOf(p)) {
        map.set(oem.trim().toLowerCase(), p);
      }
    }
    return map;
  }, [parts]);

  const matched = index.get(code.trim().toLowerCase());
  const unknownCode = Boolean(code.trim()) && !matched;

  const pushLog = (part: Part, before: number, after: number, entryMode: Mode) => {
    setLog((prev) =>
      [
        {
          id: `${part.id}-${Date.now()}`,
          partNumber: part.partNumber,
          before,
          after,
          mode: entryMode,
        },
        ...prev,
      ].slice(0, 40),
    );
  };

  const apply = () => {
    const n = Number(qty);
    if (!matched) {
      toast.error("Part not found — add it first, or check the code");
      return;
    }
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    const before = matched.quantity;
    const floorN = Math.floor(n);
    let after: number;
    if (mode === "receive") {
      const next = adjustPartQuantity(matched.id, floorN);
      after = next ?? before + floorN;
    } else {
      after = Math.max(0, floorN);
      if (after !== matched.quantity) {
        toast.message(
          `Hard override: ${matched.partNumber} on hand is ${matched.quantity} — setting absolute qty to ${after}`,
        );
      }
      updatePart(matched.id, { quantity: after });
    }
    pushLog(matched, before, after, mode);
    toast.success(
      mode === "set"
        ? `${matched.partNumber}: qty set to ${after}`
        : `${matched.partNumber}: +${floorN} → ${after}`,
    );
    setQty("");
    setCode("");
  };

  const attachPhoto = async (file: File) => {
    if (!matched) {
      toast.error("Scan or enter a part first");
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const existing =
        matched.imageUrls?.length
          ? matched.imageUrls
          : matched.imageUrl
            ? [matched.imageUrl]
            : [];
      const next = [...existing, dataUrl].slice(0, 8);
      updatePart(matched.id, { imageUrl: next[0], imageUrls: next });
      pushLog(matched, matched.quantity, matched.quantity, "photo");
      toast.success(`${matched.partNumber}: photo saved — scan next`);
      setCode("");
      setQty("");
    } catch {
      toast.error("Could not save photo");
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const onScanned = (part: Part) => {
    setCode(part.partNumber);
    setScanOpen(false);
    if (mode === "photo") {
      toast.message(`${part.partNumber} — snap a photo`);
      window.setTimeout(() => photoInputRef.current?.click(), 250);
    } else {
      toast.message(`${part.partNumber} ready — enter qty`);
    }
  };

  return (
    <>
      <PageHeader
        title="Stock take / receive"
        subtitle={
          catalogReady
            ? mode === "photo"
              ? "Scan a part, snap a photo, then scan the next"
              : "Type a part or OEM code, then set counted qty or add received qty"
            : "Loading catalog…"
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/inventory">
              <ArrowLeft className="mr-1 h-4 w-4" /> Inventory
            </Link>
          </Button>
          <Button type="button" variant="outline" className="gap-1.5" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4" />
            Scan part
          </Button>
          <Button type="button" variant="outline" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add new part
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Count, receive, or photo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "set" ? "default" : "outline"}
                onClick={() => setMode("set")}
              >
                Set counted qty
              </Button>
              <Button
                type="button"
                variant={mode === "receive" ? "default" : "outline"}
                onClick={() => setMode("receive")}
              >
                Add received
              </Button>
              <Button
                type="button"
                variant={mode === "photo" ? "default" : "outline"}
                className="gap-1.5"
                onClick={() => setMode("photo")}
              >
                <Camera className="h-4 w-4" />
                Bulk photos
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="st-code">Part / OEM code</Label>
                <Input
                  id="st-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Scan or type…"
                  autoFocus
                />
                {matched ? (
                  <p className="text-xs text-muted-foreground">
                    {matched.name} · on hand {matched.quantity}
                    {partDescriptionOf(matched) ? ` · ${partDescriptionOf(matched)}` : ""}
                    {(matched.imageUrls?.length || matched.imageUrl) ? " · has photo" : " · no photo"}
                  </p>
                ) : unknownCode ? (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive">Not in inventory</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={openCreate}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add full details (cost &amp; price optional)
                    </Button>
                  </div>
                ) : null}
              </div>
              {mode === "photo" ? (
                <div className="space-y-1.5">
                  <Label>Photo</Label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void attachPhoto(file);
                    }}
                  />
                  <Button
                    type="button"
                    className="w-full gap-1.5"
                    disabled={!catalogReady || !matched || photoBusy}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    {photoBusy ? "Saving…" : "Snap photo & next"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="st-qty">{mode === "set" ? "Counted qty" : "Qty received"}</Label>
                  <Input
                    id="st-qty"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") apply();
                    }}
                    disabled={unknownCode}
                  />
                </div>
              )}
            </div>
            {mode !== "photo" ? (
              <Button type="button" onClick={apply} disabled={!catalogReady || unknownCode || !matched}>
                Apply
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tip: use Scan part — camera opens automatically after each match.
              </p>
            )}
          </CardContent>
        </Card>

        {log.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent entries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {log.map((e) => (
                <div key={e.id} className="flex justify-between gap-2 border-b border-border py-1">
                  <span className="font-mono text-xs">{e.partNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.mode === "receive"
                      ? "receive"
                      : e.mode === "photo"
                        ? "photo"
                        : "count"}{" "}
                    · {e.mode === "photo" ? "saved" : `${e.before} → ${e.after}`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </main>

      <PartScanDialog open={scanOpen} onOpenChange={setScanOpen} onOpenPart={onScanned} />
      <PartDetailDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        part={null}
        mode="create"
        createPrefill={createPrefill}
      />
    </>
  );
}
