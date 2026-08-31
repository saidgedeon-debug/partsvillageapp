import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ShoppingCart, Search, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useDocuments } from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCloudHealth, retryCloudSync } from "@/lib/cloud-store";
import { rankByFuzzyScore } from "@/lib/fuzzy-search";
import { primaryPartImage } from "@/lib/part-image";
import { currency, partNumbersOf, type Part } from "@/lib/mock-data";

export const Route = createFileRoute("/counter")({
  component: CounterPage,
});

type Detector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (options?: { formats?: string[] }) => Detector;

function CounterPage() {
  const { parts } = useInventory();
  const { clients } = useParties();
  const { invoices } = useDocuments();
  const {
    addPart,
    lines,
    itemCount,
    setCartOpen,
    setCheckoutOpen,
    documentKind,
    setDocumentKind,
    partyId,
    partyName,
    setCartParty,
  } = useCart();
  const cloudHealth = useCloudHealth();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [query, setQuery] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      retryCloudSync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const syncBanner =
    !online
      ? {
          title: "Offline — counter still works",
          detail: "Sales save on this device and sync when you reconnect.",
          tone: "amber" as const,
        }
      : cloudHealth === "error"
        ? {
            title: "Cloud sync issue",
            detail: "Local cart is fine — retry sync so other devices see new sales.",
            tone: "amber" as const,
          }
        : cloudHealth === "syncing"
          ? {
              title: "Syncing…",
              detail: "Pushing counter changes to the cloud.",
              tone: "muted" as const,
            }
          : null;

  const recentClients = useMemo(() => {
    const seen = new Set<string>();
    const fromInvoices: { id: string; name: string }[] = [];
    const sorted = [...invoices].sort((a, b) =>
      (b.createdAt || b.date).localeCompare(a.createdAt || a.date),
    );
    for (const inv of sorted) {
      const id = inv.partyId || inv.partyName;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      fromInvoices.push({ id: inv.partyId || id, name: inv.partyName });
      if (fromInvoices.length >= 8) break;
    }
    if (fromInvoices.length > 0) return fromInvoices;
    return clients.slice(0, 8).map((c) => ({ id: c.id, name: c.name }));
  }, [invoices, clients]);

  const lastBought = useMemo(() => {
    if (!partyId && !partyName) return [];
    const clientInvoices = invoices
      .filter(
        (inv) =>
          (partyId && inv.partyId === partyId) ||
          (partyName && inv.partyName === partyName),
      )
      .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
    const seen = new Set<string>();
    const out: Part[] = [];
    for (const inv of clientInvoices) {
      for (const line of inv.lines) {
        const key = line.partId || line.partNumber;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const part =
          parts.find((p) => p.id === line.partId) ||
          parts.find((p) =>
            partNumbersOf(p).some((n) => n.toLowerCase() === line.partNumber.toLowerCase()),
          );
        if (part) {
          out.push(part);
          if (out.length >= 6) return out;
        }
      }
    }
    return out;
  }, [invoices, partyId, partyName, parts]);

  const matches = useMemo(
    () =>
      rankByFuzzyScore(
        parts,
        query,
        (part) => `${partNumbersOf(part).join(" ")} ${part.name}`,
        12,
      ),
    [parts, query],
  );

  const add = (part: Part) => {
    if (!documentKind) setDocumentKind("invoice");
    addPart(part, 1);
    toast.success(`${part.partNumber} · cart ${itemCount + 1}`);
    setQuery("");
  };

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let timer = 0;
    let stopZxing: (() => void) | null = null;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const Ctor = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        if (Ctor) {
          const detector = new Ctor();
          const scan = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const found = await detector.detect(videoRef.current);
              const code = found[0]?.rawValue?.trim();
              if (code) {
                setQuery(code);
                const hit = parts.find((part) =>
                  partNumbersOf(part).some((n) => n.toLowerCase() === code.toLowerCase()),
                );
                if (hit) add(hit);
                return;
              }
            } catch {
              // not ready
            }
            timer = window.setTimeout(scan, 700);
          };
          void scan();
          return;
        }
        const zxing = new BrowserMultiFormatReader();
        if (!videoRef.current) return;
        const controls = await zxing.decodeFromStream(stream, videoRef.current, (result) => {
          if (cancelled) return;
          const code = result?.getText()?.trim();
          if (code) {
            setQuery(code);
            const hit = parts.find((part) =>
              partNumbersOf(part).some((n) => n.toLowerCase() === code.toLowerCase()),
            );
            if (hit) add(hit);
          }
        });
        stopZxing = () => controls.stop();
      } catch (e) {
        setCameraOn(false);
        toast.error(e instanceof Error ? e.message : "Camera unavailable");
      }
    };
    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopZxing?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scan loop
  }, [cameraOn, parts]);

  const cartTotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Counter mode</p>
          <h1 className="text-lg font-bold">Scan &amp; sell</h1>
        </div>
        <Button asChild type="button" variant="ghost" size="sm">
          <Link to="/inventory">Exit</Link>
        </Button>
      </header>

      {syncBanner ? (
        <div
          role="status"
          className={
            syncBanner.tone === "amber"
              ? "flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
              : "flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2 text-sm"
          }
        >
          <div className="flex items-start gap-2">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-medium">{syncBanner.title}</p>
              <p className="text-xs text-muted-foreground">{syncBanner.detail}</p>
            </div>
          </div>
          {!online || cloudHealth === "error" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => retryCloudSync()}>
              Retry sync
            </Button>
          ) : null}
        </div>
      ) : null}

      <main className="flex flex-1 flex-col gap-3 p-3 pb-28">
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {recentClients.map((c) => {
              const selected = partyId === c.id || partyName === c.name;
              return (
                <Button
                  key={c.id}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="shrink-0"
                  onClick={() => setCartParty(c.id, c.name)}
                >
                  {c.name}
                </Button>
              );
            })}
          </div>
          {partyName ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {partyName}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2"
                onClick={() => setCartParty(undefined, undefined)}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          ) : null}
          {lastBought.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last bought
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {lastBought.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => add(part)}
                    className="shrink-0 rounded-md border border-border bg-card px-3 py-2 text-left active:bg-muted"
                  >
                    <p className="font-mono text-sm font-semibold">{part.partNumber}</p>
                    <p className="max-w-[8rem] truncate text-xs text-muted-foreground">{part.name}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          size="lg"
          variant={cameraOn ? "secondary" : "outline"}
          className="h-12 gap-2 text-base"
          onClick={() => setCameraOn((v) => !v)}
        >
          <Camera className="h-5 w-5" />
          {cameraOn ? "Stop camera" : "Start camera"}
        </Button>
        {cameraOn ? (
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-[4/3] w-full rounded-lg bg-black object-cover"
          />
        ) : null}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Part # or OEM #"
            className="h-12 pl-11 text-base"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          {matches.map((part) => {
            const img = primaryPartImage(part);
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => add(part)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left active:bg-muted"
              >
                {img ? (
                  <img src={img} alt="" className="h-16 w-16 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                    No photo
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-base font-bold">{part.partNumber}</p>
                  <p className="truncate text-sm text-muted-foreground">{part.name}</p>
                  <p className="text-sm font-semibold">
                    {part.price > 0 ? currency(part.price) : "No price"} · qty {part.quantity}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-1 gap-2 text-base"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            Cart ({itemCount}) · {currency(cartTotal)}
          </Button>
          <Button
            type="button"
            className="h-14 flex-1 text-base"
            disabled={itemCount === 0}
            onClick={() => {
              if (!documentKind) setDocumentKind("invoice");
              setCheckoutOpen(true);
            }}
          >
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
