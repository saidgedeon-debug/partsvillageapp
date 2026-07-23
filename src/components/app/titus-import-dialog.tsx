import { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useShipments } from "@/components/app/shipments-context";
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
import { Textarea } from "@/components/ui/textarea";
import {
  mergeTitusIntoExisting,
  parseTitusPaste,
  titusOrderToParsed,
  titusParseToInput,
  titusRowHasChanges,
} from "@/lib/titus-import";
import {
  clearTitusCreds,
  loadTitusCreds,
  markTitusSyncedNow,
  saveTitusCreds,
  syncTitusOrders,
} from "@/lib/titus-sync";

const TITUS_USER = "https://login.titus-logistics.com/user.php";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TitusImportDialog({ open, onOpenChange }: Props) {
  const { shipments, addShipment, updateShipment } = useShipments();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [text, setText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    const saved = loadTitusCreds();
    if (saved) {
      setUsername(saved.username);
      setPassword(saved.password);
      setHasSaved(true);
    }
  }, [open]);

  const parsed = useMemo(() => parseTitusPaste(text), [text]);

  const applyParsed = (
    rows: ReturnType<typeof titusOrderToParsed>[],
    opts?: { quiet?: boolean },
  ) => {
    let added = 0;
    let updated = 0;
    for (const p of rows) {
      const existing = shipments.find(
        (s) => (s.trackingNumber ?? "").toUpperCase() === p.trackingNumber,
      );
      if (existing) {
        if (!titusRowHasChanges(existing, p)) continue;
        updateShipment(existing.id, mergeTitusIntoExisting(existing, p));
        updated += 1;
      } else {
        addShipment(titusParseToInput(p));
        added += 1;
      }
    }
    if (!opts?.quiet) {
      if (added === 0 && updated === 0) {
        toast.message("Titus is up to date — no changes");
      } else {
        toast.success(
          `Titus sync` +
            (added ? ` · ${added} new` : "") +
            (updated ? ` · ${updated} updated` : ""),
        );
      }
    }
    return { added, updated };
  };

  const runAutoSync = async () => {
    const user = username.trim();
    const pass = password;
    if (!user || !pass) {
      toast.error("Enter Titus user and password");
      return;
    }

    setSyncing(true);
    try {
      saveTitusCreds({ username: user, password: pass });
      setHasSaved(true);

      const result = await syncTitusOrders({ data: { username: user, password: pass } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      applyParsed(result.orders.map(titusOrderToParsed));
      markTitusSyncedNow();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Titus sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const importPaste = () => {
    if (parsed.length === 0) {
      toast.error("No shipment numbers found — copy from Titus and paste here");
      return;
    }
    applyParsed(parsed);
    setText("");
    onOpenChange(false);
  };

  const forgetCreds = () => {
    clearTitusCreds();
    setPassword("");
    setHasSaved(false);
    toast.message("Titus login cleared from this browser");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync Titus</DialogTitle>
          <DialogDescription>
            User & password stay saved in this browser only (not in git). Sync pulls new / changed
            shipments into Shipments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="titus-user">Titus user</Label>
            <Input
              id="titus-user"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="titus-pass">Password</Label>
            <Input
              id="titus-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={syncing || !username.trim() || !password}
              onClick={() => void runAutoSync()}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Save & sync now"}
            </Button>
            {hasSaved && (
              <Button type="button" variant="outline" className="gap-1.5" onClick={forgetCreds}>
                <Trash2 className="h-4 w-4" />
                Forget login
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {hasSaved
              ? "Login saved — Shipments page will auto-sync when there are changes."
              : "After save, the app auto-checks Titus in the background."}
          </p>
        </div>

        <div className="relative py-1 text-center text-xs text-muted-foreground">
          <span className="bg-background px-2">or paste manually</span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => window.open(TITUS_USER, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-4 w-4" />
          Open Titus
        </Button>

        <div className="space-y-1.5">
          <Label htmlFor="titus-paste">Paste from Titus</Label>
          <Textarea
            id="titus-paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Example:\nShipment No.GZ201234 Total：12Ctns-1.25Cbm-86KG`}
            className="min-h-[120px] font-mono text-xs"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Detected: <span className="font-semibold text-foreground">{parsed.length}</span> shipment
          {parsed.length === 1 ? "" : "s"}
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            disabled={parsed.length === 0}
            onClick={importPaste}
          >
            <ClipboardPaste className="h-4 w-4" />
            Import paste {parsed.length || ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
