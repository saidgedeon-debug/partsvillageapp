import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { averageHashFromBlob, averageHashFromDataUrl, hashDistance } from "@/lib/image-hash";
import { primaryPartImage } from "@/lib/part-image";
import { currency, partNumbersOf, type Part } from "@/lib/mock-data";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Match = { part: Part; score: number; via: "barcode" | "photo" };

export function PhotoPartMatchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { parts } = useInventory();
  const { addPart, setDocumentKind, documentKind, setCartOpen } = useCart();
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const runMatch = async (file: File) => {
    setBusy(true);
    setMatches([]);
    try {
      const url = URL.createObjectURL(file);
      const img = document.createElement("img");
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("bad image"));
        img.src = url;
      });

      // 1) Try barcode in photo
      try {
        const reader = new BrowserMultiFormatReader();
        const result = await reader.decodeFromImageElement(img);
        const code = result.getText()?.trim();
        if (code) {
          const hit = parts.find((p) =>
            partNumbersOf(p).some((n) => n.toLowerCase() === code.toLowerCase()),
          );
          if (hit) {
            setMatches([{ part: hit, score: 100, via: "barcode" }]);
            URL.revokeObjectURL(url);
            return;
          }
        }
      } catch {
        // no barcode — fall through to visual hash
      }

      const probe = await averageHashFromBlob(file);
      if (!probe) {
        toast.error("Could not analyze photo");
        URL.revokeObjectURL(url);
        return;
      }

      const scored: Match[] = [];
      for (const part of parts) {
        const src = primaryPartImage(part);
        if (!src?.startsWith("data:image") && !src?.startsWith("http")) continue;
        const hash = await averageHashFromDataUrl(src);
        if (!hash) continue;
        const dist = hashDistance(probe, hash);
        if (dist <= 18) {
          scored.push({ part, score: Math.max(0, 100 - dist * 4), via: "photo" });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      setMatches(scored.slice(0, 8));
      if (!scored.length) {
        toast.message("No close photo match — try a barcode or clearer part photo");
      }
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Match failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Photo → part match</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Snap a barcode or a part that already has a photo in inventory. Best
          matches appear below.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void runMatch(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          className="w-full gap-2"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {busy ? "Matching…" : "Take / choose photo"}
        </Button>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {matches.map((m) => (
            <button
              key={m.part.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-left hover:bg-muted/40"
              onClick={() => {
                if (!documentKind) setDocumentKind("invoice");
                addPart(m.part, 1);
                setCartOpen(true);
                toast.success(`Added ${m.part.partNumber}`);
                onOpenChange(false);
              }}
            >
              {primaryPartImage(m.part) ? (
                <img
                  src={primaryPartImage(m.part)!}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-semibold">{m.part.partNumber}</p>
                <p className="truncate text-xs text-muted-foreground">{m.part.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {m.via} · {m.score}% · {currency(m.part.price)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
