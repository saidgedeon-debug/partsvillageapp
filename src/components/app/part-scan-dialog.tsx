import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { primaryPartImage } from "@/lib/part-image";
import { partNumbersOf, type Part } from "@/lib/mock-data";

type Detector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (options?: { formats?: string[] }) => Detector;

export function PartScanDialog({
  open,
  onOpenChange,
  onOpenPart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPart: (part: Part) => void;
}) {
  const { parts } = useInventory();
  const { addPart, setCartOpen } = useCart();
  const [query, setQuery] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const exact = parts.filter((part) =>
      partNumbersOf(part).some((number) => number.toLowerCase() === q),
    );
    if (exact.length) return exact.slice(0, 8);
    return parts
      .filter((part) => partNumbersOf(part).some((number) => number.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [parts, query]);

  useEffect(() => {
    if (!open || !cameraOn) return;
    let cancelled = false;
    let timer = 0;
    let stopZxing: (() => void) | null = null;

    const handleCode = (code: string) => {
      setQuery(code);
      setCameraOn(false);
      const hit = parts.find((part) =>
        partNumbersOf(part).some((number) => number.toLowerCase() === code.toLowerCase()),
      );
      if (hit) {
        onOpenChange(false);
        onOpenPart(hit);
        toast.success(`Opened ${hit.partNumber}`);
      }
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
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
                handleCode(code);
                return;
              }
            } catch {
              // Video may not be ready for a frame yet.
            }
            timer = window.setTimeout(scan, 700);
          };
          void scan();
          return;
        }

        // Fallback for browsers without BarcodeDetector (Firefox, some Safari).
        const zxing = new BrowserMultiFormatReader();
        if (!videoRef.current) return;
        const controls = await zxing.decodeFromStream(stream, videoRef.current, (result) => {
          if (cancelled) return;
          const code = result?.getText()?.trim();
          if (code) {
            stopZxing?.();
            handleCode(code);
          }
        });
        stopZxing = () => controls.stop();
      } catch (error) {
        setCameraOn(false);
        toast.error(error instanceof Error ? error.message : "Camera could not be opened");
      }
    };
    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopZxing?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, cameraOn, parts, onOpenChange, onOpenPart]);

  useEffect(() => {
    if (!open) {
      setCameraOn(false);
      setQuery("");
    }
  }, [open]);

  const choose = (part: Part) => {
    onOpenChange(false);
    onOpenPart(part);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan or find a part</DialogTitle>
          <DialogDescription>
            Scan a barcode with your phone camera, or type/paste a part or OEM number.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            type="button"
            variant={cameraOn ? "secondary" : "outline"}
            className="w-full gap-2"
            onClick={() => setCameraOn((value) => !value)}
          >
            <Camera className="h-4 w-4" />
            {cameraOn ? "Stop camera" : "Open camera scanner"}
          </Button>
          {cameraOn ? (
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-video w-full rounded-md bg-black object-cover"
            />
          ) : null}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Part # or OEM #"
              className="pl-9"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {query && matches.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">No matching part.</p>
            ) : null}
            {matches.map((part) => {
              const img = primaryPartImage(part);
              return (
                <div key={part.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                      No photo
                    </div>
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => choose(part)}
                  >
                    <p className="font-mono text-sm font-semibold">{part.partNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">{part.name}</p>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addPart(part, 1);
                      setCartOpen(true);
                      onOpenChange(false);
                      toast.success(`${part.partNumber} added to cart`);
                    }}
                  >
                    <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
