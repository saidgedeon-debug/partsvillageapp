import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { useCart, type PartyKind } from "@/components/app/cart-context";
import {
  downloadExcel,
  downloadPdf,
  openWeChatShare,
  openWhatsApp,
} from "@/lib/document-export";
import { clients } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CheckoutDialog() {
  const { checkoutOpen, setCheckoutOpen, lines, documentKind, clearCart, setCartOpen } = useCart();
  const [partyKind, setPartyKind] = useState<PartyKind>("client");
  const [partyName, setPartyName] = useState("");

  useEffect(() => {
    if (checkoutOpen) {
      setPartyKind(documentKind === "inquiry" ? "supplier" : "client");
      setPartyName("");
    }
  }, [checkoutOpen, documentKind]);

  if (!documentKind) return null;

  const ready = lines.length > 0 && partyName.trim().length > 0;

  const docPayload = () => ({
    documentKind,
    partyKind,
    partyName: partyName.trim(),
    lines,
  });

  const onPdf = () => {
    if (!ready) return;
    const id = downloadPdf(docPayload());
    toast.success(`PDF downloaded (${id})`);
  };

  const onExcel = () => {
    if (!ready) return;
    const id = downloadExcel(docPayload());
    toast.success(`Excel downloaded (${id})`);
  };

  const onWhatsApp = () => {
    if (!ready) return;
    downloadPdf(docPayload());
    openWhatsApp(docPayload());
    toast.success("WhatsApp opened — PDF also downloaded to attach if needed");
  };

  const onWeChat = () => {
    if (!ready) return;
    downloadPdf(docPayload());
    openWeChatShare(docPayload());
    toast.success("Message copied — open WeChat and paste / attach the PDF");
  };

  return (
    <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finish document</DialogTitle>
          <DialogDescription>
            Choose client or supplier, then download or send via WhatsApp / WeChat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              variant={partyKind === "client" ? "default" : "outline"}
              onClick={() => setPartyKind("client")}
            >
              Client
            </Button>
            <Button
              type="button"
              className="flex-1"
              variant={partyKind === "supplier" ? "default" : "outline"}
              onClick={() => setPartyKind("supplier")}
            >
              Supplier
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="party-name">
              {partyKind === "client" ? "Client name" : "Supplier name"}
            </Label>
            <Input
              id="party-name"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder={
                partyKind === "client" ? "e.g. Ironclad Excavation" : "e.g. Caterpillar Global Parts"
              }
              list="party-suggestions"
            />
            {partyKind === "client" && clients.length > 0 && (
              <datalist id="party-suggestions">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="gap-2" disabled={!ready} onClick={onPdf}>
              <FileText className="h-4 w-4" />
              Download PDF
            </Button>
            <Button type="button" variant="outline" className="gap-2" disabled={!ready} onClick={onExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel
            </Button>
            <Button type="button" variant="outline" className="gap-2" disabled={!ready} onClick={onWhatsApp}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button type="button" variant="outline" className="gap-2" disabled={!ready} onClick={onWeChat}>
              <Download className="h-4 w-4" />
              WeChat
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setCheckoutOpen(false);
                setCartOpen(true);
              }}
            >
              Back to cart
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!ready}
              onClick={() => {
                onPdf();
                clearCart();
                setCheckoutOpen(false);
                setCartOpen(false);
                toast.success("Document created — cart cleared");
              }}
            >
              Create & close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
