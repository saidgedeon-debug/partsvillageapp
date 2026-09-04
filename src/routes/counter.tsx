import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ImageIcon, ShoppingCart, Search, Star, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { PhotoPartMatchDialog } from "@/components/app/photo-part-match-dialog";
import { VoiceCartButton } from "@/components/app/voice-cart-button";
import { useDocuments } from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useKits } from "@/components/app/kits-context";
import { useParties } from "@/components/app/parties-context";
import { usePrefs } from "@/components/app/prefs-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCloudHealth, usePendingSyncCount, retryCloudSync } from "@/lib/cloud-store";
import { addKitPartsToCart, kitsForMachine } from "@/lib/cross-sell";
import { rankByFuzzyScore } from "@/lib/fuzzy-search";
import { primaryPartImage } from "@/lib/part-image";
import { lastClientSalePrice } from "@/lib/part-price-history";
import { findSubstituteParts } from "@/lib/part-identity";
import { currency, partNumbersOf, type Part } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/counter")({
  component: CounterPage,
});

type Detector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (options?: { formats?: string[] }) => Detector;

function CounterPage() {
  const { parts, getPart } = useInventory();
  const { clients } = useParties();
  const { invoices } = useDocuments();
  const { machinesByClient } = useFleet();
  const { kits } = useKits();
  const { isFavorite, toggleFavorite, favoritePartIds } = usePrefs();
  const {
    addPart,
    lines,
    itemCount,
    setCartOpen,
    openCheckout,
    documentKind,
    setDocumentKind,
    partyId,
    partyName,
    setCartParty,
    updateLinePrice,
    heldCarts,
    resumeHeldCart,
    discardHeldCart,
  } = useCart();
  const [heldOpen, setHeldOpen] = useState(false);
  const [kitMachineId, setKitMachineId] = useState<string>("");
  const [subPrompt, setSubPrompt] = useState<{
    original: Part;
    substitutes: Part[];
  } | null>(null);
  const cloudHealth = useCloudHealth();
  const pendingSync = usePendingSyncCount();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [query, setQuery] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [photoMatchOpen, setPhotoMatchOpen] = useState(false);
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
          detail:
            pendingSync > 0
              ? `${pendingSync} change${pendingSync === 1 ? "" : "s"} waiting to sync when you’re back online.`
              : "Cart, checkout, and invoices stay on this phone — they sync automatically when you’re back online.",
          tone: "amber" as const,
        }
      : pendingSync > 0 || cloudHealth === "syncing"
        ? {
            title:
              pendingSync > 0
                ? `${pendingSync} waiting to sync`
                : "Syncing…",
            detail: "Pushing counter changes to the cloud.",
            tone: "muted" as const,
          }
        : cloudHealth === "error"
          ? {
              title: "Cloud sync issue",
              detail: "Local cart is fine — retry sync so other devices see new sales.",
              tone: "amber" as const,
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

  const clientMachines = useMemo(() => {
    if (!partyId) return [];
    return machinesByClient(partyId);
  }, [machinesByClient, partyId]);

  const activeKitMachine = useMemo(() => {
    if (!clientMachines.length) return undefined;
    return clientMachines.find((m) => m.id === kitMachineId) ?? clientMachines[0];
  }, [clientMachines, kitMachineId]);

  const counterKits = useMemo(() => {
    if (!activeKitMachine) return [];
    return kitsForMachine(kits, activeKitMachine.make, activeKitMachine.model);
  }, [activeKitMachine, kits]);

  useEffect(() => {
    if (!partyId) {
      setKitMachineId("");
      return;
    }
    const list = machinesByClient(partyId);
    if (list.length === 0) {
      setKitMachineId("");
      return;
    }
    if (!list.some((m) => m.id === kitMachineId)) {
      setKitMachineId(list[0].id);
    }
  }, [partyId, machinesByClient, kitMachineId]);

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

  const qTrim = query.trim();
  const exactHit = useMemo(() => {
    if (!qTrim) return undefined;
    const lower = qTrim.toLowerCase();
    return parts.find((part) => {
      const codes =
        part.partNumbers?.length && part.partNumbers.some((n) => n.trim())
          ? part.partNumbers
          : [part.partNumber];
      return codes.some((n) => n.trim().toLowerCase() === lower);
    });
  }, [parts, qTrim]);

  const supersession = useMemo(() => {
    if (!qTrim || exactHit) return undefined;
    const lower = qTrim.toLowerCase();
    return parts.find((part) =>
      (part.replacesCodes ?? []).some((c) => c.trim().toLowerCase() === lower),
    );
  }, [parts, qTrim, exactHit]);

  const add = (part: Part, opts?: { force?: boolean }) => {
    if (!opts?.force && part.quantity <= 0) {
      const substitutes = findSubstituteParts(parts, part);
      if (substitutes.length > 0) {
        setSubPrompt({ original: part, substitutes });
        return;
      }
      toast.message(`${part.partNumber} is out of stock`);
    }
    if (!documentKind) setDocumentKind("invoice");
    addPart(part, 1);
    toast.success(`${part.partNumber} · cart ${itemCount + 1}`);
    setQuery("");
    setSubPrompt(null);
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
  const stripLines = lines.slice(0, 4);

  const editLinePrice = (partId: string, current: number, label: string) => {
    const raw = window.prompt(`New price for ${label}`, String(current));
    if (raw == null) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid price");
      return;
    }
    let reason: string | undefined;
    if (Math.abs(n - current) > 0.0005) {
      reason = window.prompt("Reason for price change (optional)")?.trim() || undefined;
    }
    updateLinePrice(partId, n, reason);
  };

  const favorites = useMemo(() => {
    const set = new Set(favoritePartIds);
    return parts.filter((p) => set.has(p.id)).slice(0, 20);
  }, [parts, favoritePartIds]);

  const openFinish = (whatsapp = false) => {
    if (!documentKind) setDocumentKind("invoice");
    openCheckout({ whatsapp });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Counter mode</p>
          <h1 className="text-lg font-bold">Scan &amp; sell</h1>
        </div>
        <div className="flex items-center gap-2">
          {heldCarts.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="tabular-nums"
              onClick={() => setHeldOpen((v) => !v)}
            >
              Held {heldCarts.length}
            </Button>
          ) : null}
          <Button asChild type="button" variant="ghost" size="sm">
            <Link to="/inventory">Exit</Link>
          </Button>
        </div>
      </header>

      {heldOpen && heldCarts.length > 0 ? (
        <div className="space-y-2 border-b bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Resume held cart
          </p>
          {heldCarts.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{h.label}</p>
                <p className="text-xs text-muted-foreground">
                  {h.lines.length} line{h.lines.length === 1 ? "" : "s"}
                  {h.partyName ? ` · ${h.partyName}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    resumeHeldCart(h.id);
                    setHeldOpen(false);
                    toast.success(`Resumed ${h.label}`);
                  }}
                >
                  Resume
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    discardHeldCart(h.id);
                    toast.message("Held cart discarded");
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {subPrompt ? (
        <div className="space-y-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-3">
          <p className="text-sm font-medium">
            {subPrompt.original.partNumber} is out of stock — try a substitute?
          </p>
          <div className="flex flex-wrap gap-2">
            {subPrompt.substitutes.map((s) => (
              <Button key={s.id} type="button" size="sm" onClick={() => add(s, { force: true })}>
                {s.partNumber} · qty {s.quantity}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => add(subPrompt.original, { force: true })}
            >
              Add anyway
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSubPrompt(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

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

      <main className="flex flex-1 flex-col gap-3 p-3 pb-[calc(10.5rem+env(safe-area-inset-bottom))]">
        {stripLines.length > 0 ? (
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cart · {itemCount} line{itemCount === 1 ? "" : "s"}
              </p>
              <p className="text-sm font-semibold">{currency(cartTotal)}</p>
            </div>
            <ul className="space-y-1">
              {stripLines.map((line) => (
                <li
                  key={line.partId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate font-mono text-xs font-semibold">
                    {line.partNumber}{" "}
                    <span className="font-sans font-normal text-muted-foreground">
                      ×{line.qty}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded px-1.5 py-0.5 font-semibold tabular-nums underline-offset-2 hover:bg-muted hover:underline"
                    onClick={() => editLinePrice(line.partId, line.unitPrice, line.partNumber)}
                  >
                    {currency(line.unitPrice)}
                  </button>
                </li>
              ))}
            </ul>
            {lines.length > 4 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                +{lines.length - 4} more in cart
              </p>
            ) : null}
          </div>
        ) : null}

        {favorites.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Favorites · quick sell
            </p>
            <div className="flex flex-wrap gap-2">
              {favorites.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => add(part)}
                  className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-left active:bg-accent/15"
                >
                  <p className="font-mono text-sm font-semibold">{part.partNumber}</p>
                  <p className="max-w-[10rem] truncate text-xs text-muted-foreground">
                    {part.price > 0 ? currency(part.price) : part.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
            {recentClients.map((c) => {
              const selected = partyId === c.id || partyName === c.name;
              return (
                <Button
                  key={c.id}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
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
          {clientMachines.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Machine kit
              </p>
              <div className="flex flex-wrap gap-2">
                {clientMachines.map((m) => (
                  <Button
                    key={m.id}
                    type="button"
                    size="sm"
                    variant={activeKitMachine?.id === m.id ? "default" : "outline"}
                    onClick={() => setKitMachineId(m.id)}
                  >
                    {m.make} {m.model}
                  </Button>
                ))}
              </div>
              {counterKits.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {counterKits.map((kit) => (
                    <Button
                      key={kit.id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (!documentKind) setDocumentKind("invoice");
                        const n = addKitPartsToCart(kit, getPart, addPart);
                        setCartOpen(true);
                        toast.success(
                          n > 0
                            ? `Added ${n} parts from “${kit.name}”`
                            : `No stocked parts found for “${kit.name}”`,
                        );
                      }}
                    >
                      Sell {kit.name} ({kit.lines.length})
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No kits match {activeKitMachine?.make} {activeKitMachine?.model} — create one in
                  Kits.
                </p>
              )}
            </div>
          ) : null}
          {lastBought.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last bought
              </p>
              <div className="flex flex-wrap gap-2">
                {lastBought.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => add(part)}
                    className="rounded-md border border-border bg-card px-3 py-2 text-left active:bg-muted"
                  >
                    <p className="font-mono text-sm font-semibold">{part.partNumber}</p>
                    <p className="max-w-[10rem] truncate text-xs text-muted-foreground">{part.name}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <VoiceCartButton />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setPhotoMatchOpen(true)}
          >
            <ImageIcon className="h-4 w-4" />
            Photo match
          </Button>
          <Button
            type="button"
            size="lg"
            variant={cameraOn ? "secondary" : "outline"}
            className="h-12 flex-1 gap-2 text-base"
            onClick={() => setCameraOn((v) => !v)}
          >
            <Camera className="h-5 w-5" />
            {cameraOn ? "Stop camera" : "Start camera"}
          </Button>
        </div>
        <PhotoPartMatchDialog open={photoMatchOpen} onOpenChange={setPhotoMatchOpen} />
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
        {supersession ? (
          <button
            type="button"
            onClick={() => add(supersession)}
            className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-left text-sm active:bg-amber-500/20"
          >
            <p className="font-medium">
              <span className="font-mono font-bold">{supersession.partNumber}</span> replaces{" "}
              <span className="font-mono">{qTrim}</span>
            </p>
            <p className="text-xs text-muted-foreground">Tap to add the replacement part</p>
          </button>
        ) : null}
        <div className="space-y-2">
          {matches.map((part) => {
            const img = primaryPartImage(part);
            const last = lastClientSalePrice(part.id, part.partNumber, invoices, {
              id: partyId,
              name: partyName,
            });
            const fav = isFavorite(part.id);
            return (
              <div
                key={part.id}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-card p-2"
              >
                <button
                  type="button"
                  onClick={() => add(part)}
                  className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left active:opacity-80"
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
                    {last ? (
                      <p className="text-xs text-accent">
                        Last for {partyName}: {currency(last.amount)} · {last.date}
                      </p>
                    ) : null}
                  </div>
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 shrink-0"
                  aria-label={fav ? "Unpin favorite" : "Pin favorite"}
                  onClick={() => {
                    toggleFavorite(part.id);
                    toast.message(fav ? "Removed from favorites" : "Pinned to favorites");
                  }}
                >
                  <Star className={cn("h-5 w-5", fav && "fill-amber-400 text-amber-500")} />
                </Button>
              </div>
            );
          })}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="relative h-12 flex-1 gap-2 text-base"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              Cart ({itemCount}) · {currency(cartTotal)}
              {heldCarts.length > 0 ? (
                <Badge
                  variant="secondary"
                  className="absolute -right-1 -top-2 h-5 min-w-5 px-1 text-[10px]"
                >
                  {heldCarts.length} held
                </Badge>
              ) : null}
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 text-base"
              disabled={itemCount === 0}
              onClick={() => openFinish(false)}
            >
              Checkout
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full text-base"
            disabled={itemCount === 0}
            onClick={() => openFinish(true)}
          >
            Finish &amp; WhatsApp PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
