import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText, HardDrive, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { useCart, type PartyKind } from "@/components/app/cart-context";
import {
  exportAndDeliver,
  type DeliveryMethod,
  type ExportFormat,
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
import { cn } from "@/lib/utils";

export function CheckoutDialog() {
  const { checkoutOpen, setCheckoutOpen, lines, documentKind, clearCart, setCartOpen } = useCart();
  const [partyKind, setPartyKind] = useState<PartyKind>("client");
  const [partyName, setPartyName] = useState("");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [includeCost, setIncludeCost] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryMethod>("offline");

  const isInquiry = documentKind === "inquiry";

  useEffect(() => {
    if (checkoutOpen) {
      setPartyKind(documentKind === "inquiry" ? "supplier" : "client");
      setPartyName("");
      setFormat("pdf");
      setIncludeCost(true);
      setDelivery("offline");
    }
  }, [checkoutOpen, documentKind]);

  if (!documentKind) return null;

  const ready = lines.length > 0 && partyName.trim().length > 0;

  const runExport = (andClose: boolean) => {
    if (!ready) return;
    const id = exportAndDeliver(
      {
        documentKind,
        partyKind,
        partyName: partyName.trim(),
        lines,
        includeCost: isInquiry ? includeCost : true,
      },
      format,
      delivery,
    );

    const fmt = format === "pdf" ? "PDF" : "Excel";
    const deliveryMsg =
      delivery === "whatsapp"
        ? " — WhatsApp opened"
        : delivery === "wechat"
          ? " — message copied for WeChat"
          : delivery === "email"
            ? " — email draft opened"
            : " — saved offline";

    toast.success(`${fmt} created (${id})${deliveryMsg}`);

    if (andClose) {
      clearCart();
      setCheckoutOpen(false);
      setCartOpen(false);
    }
  };

  return (
    <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finish document</DialogTitle>
          <DialogDescription>
            Choose party, file format
            {isInquiry ? ", cost visibility," : ","} and how to send or save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-2">
            <Label>Party</Label>
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
          </section>

          {isInquiry && (
            <section className="space-y-2">
              <Label>Include supplier cost?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  variant={includeCost ? "default" : "outline"}
                  onClick={() => setIncludeCost(true)}
                >
                  With cost
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  variant={!includeCost ? "default" : "outline"}
                  onClick={() => setIncludeCost(false)}
                >
                  Without cost
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Costs are filled automatically from inventory when available.
              </p>
            </section>
          )}

          <section className="space-y-2">
            <Label>File format</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={format === "pdf" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setFormat("pdf")}
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button
                type="button"
                variant={format === "excel" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setFormat("excel")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <Label>Send or save</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
                  { id: "wechat" as const, label: "WeChat", icon: MessageCircle },
                  { id: "email" as const, label: "Email", icon: Mail },
                  { id: "offline" as const, label: "Save offline", icon: HardDrive },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  type="button"
                  variant={delivery === id ? "default" : "outline"}
                  className={cn("gap-2")}
                  onClick={() => setDelivery(id)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              File always downloads. WhatsApp / WeChat / Email also open a share draft.
            </p>
          </section>

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
              onClick={() => runExport(true)}
            >
              Create & close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
