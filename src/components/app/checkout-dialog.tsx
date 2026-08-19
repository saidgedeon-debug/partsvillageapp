import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, HardDrive, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { useCart, type PartyKind } from "@/components/app/cart-context";
import { DocumentDiscountControls } from "@/components/app/document-discount-controls";
import { useDocuments, type SavedDocument } from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useParties } from "@/components/app/parties-context";
import { PartySearchPicker } from "@/components/app/party-search-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  exportAndDeliver,
  lineTotal,
  type DeliveryMethod,
  type ExportFormat,
} from "@/lib/document-export";
import {
  documentGrandTotal,
  normalizeDocumentDiscount,
  roundMoney,
  type DocumentDiscountType,
} from "@/lib/document-money";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { clearDocumentCreatedParts, isDocumentCreatedPart } from "@/lib/document-created-parts";
import {
  confirmOversell,
  lineQtyByPart,
  stockShortagesForQty,
} from "@/lib/stock-sale";

export function CheckoutDialog() {
  const { checkoutOpen, setCheckoutOpen, lines, documentKind, clearCart, setCartOpen } = useCart();
  const { addDocument } = useDocuments();
  const { adjustPartQuantity, getPart } = useInventory();
  const { addOrder, machinesByClient } = useFleet();
  const { clients, suppliers } = useParties();
  const [partyKind, setPartyKind] = useState<PartyKind>("client");
  const [partyName, setPartyName] = useState("");
  const [partyId, setPartyId] = useState<string | undefined>();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [includeCost, setIncludeCost] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryMethod>("offline");
  const [deductStock, setDeductStock] = useState(true);
  const [machineId, setMachineId] = useState("");
  const [discountType, setDiscountType] = useState<DocumentDiscountType>("percent");
  const [discountValue, setDiscountValue] = useState(0);

  const isInquiry = documentKind === "inquiry";
  const isInvoice = documentKind === "invoice";
  const canDiscount = documentKind === "quotation" || documentKind === "invoice";

  useEffect(() => {
    if (checkoutOpen) {
      setPartyKind(documentKind === "inquiry" ? "supplier" : "client");
      setPartyName("");
      setPartyId(undefined);
      setFormat("pdf");
      setIncludeCost(true);
      setDelivery("offline");
      setDeductStock(true);
      setMachineId("");
      setDiscountType("percent");
      setDiscountValue(0);
    }
  }, [checkoutOpen, documentKind]);

  const subtotal = useMemo(() => {
    if (!documentKind) return 0;
    return roundMoney(lines.reduce((s, l) => s + lineTotal(l, documentKind), 0));
  }, [lines, documentKind]);

  const discount = useMemo(
    () => (canDiscount ? normalizeDocumentDiscount(discountType, discountValue) : undefined),
    [canDiscount, discountType, discountValue],
  );

  const total = useMemo(() => documentGrandTotal(subtotal, discount), [subtotal, discount]);

  if (!documentKind) return null;

  const ready = lines.length > 0 && partyName.trim().length > 0;

  const runExport = async (andClose: boolean) => {
    if (!ready) return;
    const createdAt = new Date();
    const selectedParty =
      partyKind === "client"
        ? clients.find((party) => party.id === partyId)
        : suppliers.find((party) => party.id === partyId);
    const appliedDiscount = canDiscount
      ? normalizeDocumentDiscount(discountType, discountValue)
      : undefined;
    const computedTotal = documentGrandTotal(subtotal, appliedDiscount);

    if (isInvoice && deductStock) {
      const skipCreated = new Set(
        lines.filter((l) => isDocumentCreatedPart(l.partId)).map((l) => l.partId),
      );
      if (!confirmOversell(stockShortagesForQty(lineQtyByPart(lines), getPart, skipCreated))) {
        return;
      }
    }

    const { id, sharedFile, cancelled } = await exportAndDeliver(
      {
        documentKind,
        partyKind,
        partyName: partyName.trim(),
        partyPhone: selectedParty?.phone,
        lines,
        createdAt,
        includeCost: isInquiry ? includeCost : true,
        discountType: appliedDiscount?.type,
        discountValue: appliedDiscount?.value,
      },
      format,
      delivery,
    );

    if (cancelled) {
      toast.message("Share cancelled");
      return;
    }

    let stockDeducted = false;
    if (isInvoice && deductStock) {
      let deducted = 0;
      for (const line of lines) {
        const part = getPart(line.partId);
        if (!part) continue;
        if (isDocumentCreatedPart(line.partId) && part.quantity < line.qty) {
          adjustPartQuantity(line.partId, line.qty - part.quantity);
        }
        adjustPartQuantity(line.partId, -line.qty);
        deducted += 1;
      }
      stockDeducted = deducted > 0;
    }

    const status: SavedDocument["status"] =
      documentKind === "quotation" ? "Sent" : documentKind === "invoice" ? "Unpaid" : "Open";

    const saved: SavedDocument = {
      id,
      kind: documentKind,
      partyKind,
      partyId,
      partyName: partyName.trim(),
      date: createdAt.toISOString().slice(0, 10),
      createdAt: createdAt.toISOString(),
      total: computedTotal,
      status,
      includeCost: isInquiry ? includeCost : undefined,
      lines: [...lines],
      stockDeducted,
      discountType: appliedDiscount?.type,
      discountValue: appliedDiscount?.value,
    };
    addDocument(saved);

    if (isInvoice && partyKind === "client") {
      const client =
        (partyId && clients.find((c) => c.id === partyId)) ||
        clients.find((c) => c.name.toLowerCase() === partyName.trim().toLowerCase());
      if (client) {
        addOrder({
          id: `ord-${id}`,
          clientId: client.id,
          machineId,
          date: saved.date,
          status: "Pending",
          documentId: id,
          lines: lines.map((l) => ({
            partId: l.partId,
            partNumber: l.partNumber,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
          })),
        });
      }
    }

    const fmt = format === "pdf" ? "PDF" : "Excel";
    const deliveryMsg = sharedFile
      ? " — PDF file shared"
      : delivery === "whatsapp"
        ? format === "pdf"
          ? " — PDF downloaded, WhatsApp opened"
          : " — WhatsApp opened"
        : delivery === "wechat"
          ? format === "pdf"
            ? " — PDF downloaded, message copied for WeChat"
            : " — message copied for WeChat"
          : delivery === "email"
            ? format === "pdf"
              ? " — PDF downloaded, email draft opened"
              : " — email draft opened"
            : " — saved offline";
    const stockMsg = stockDeducted ? " · stock updated" : "";
    toast.success(`${fmt} saved (${id})${deliveryMsg}${stockMsg}`);

    if (andClose) {
      clearCart();
      clearDocumentCreatedParts();
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
            Search a saved client/supplier or create a new one, then choose format and delivery. The
            document is saved to Documents automatically.
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
                onClick={() => {
                  setPartyKind("client");
                  setPartyName("");
                  setPartyId(undefined);
                }}
              >
                Client
              </Button>
              <Button
                type="button"
                className="flex-1"
                variant={partyKind === "supplier" ? "default" : "outline"}
                onClick={() => {
                  setPartyKind("supplier");
                  setPartyName("");
                  setPartyId(undefined);
                }}
              >
                Supplier
              </Button>
            </div>
            <PartySearchPicker
              kind={partyKind}
              selectedName={partyName}
              onSelect={(p) => {
                setPartyName(p.name);
                setPartyId(p.id);
                setMachineId("");
              }}
            />
            {isInvoice && partyId ? (
              <div className="space-y-1.5">
                <Label htmlFor="checkout-machine">Machine (optional)</Label>
                <Select
                  value={machineId || "__none__"}
                  onValueChange={(value) => setMachineId(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger id="checkout-machine">
                    <SelectValue placeholder="No machine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No machine</SelectItem>
                    {machinesByClient(partyId).map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.make} {machine.model} · {machine.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </section>

          {canDiscount && lines.length > 0 ? (
            <DocumentDiscountControls
              subtotal={subtotal}
              discountType={discountType}
              discountValue={discountValue}
              onTypeChange={setDiscountType}
              onValueChange={setDiscountValue}
            />
          ) : null}

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
            </section>
          )}

          {isInvoice && (
            <section className="space-y-2">
              <Label>Stock</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  variant={deductStock ? "default" : "outline"}
                  onClick={() => setDeductStock(true)}
                >
                  Deduct qty
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  variant={!deductStock ? "default" : "outline"}
                  onClick={() => setDeductStock(false)}
                >
                  Keep qty
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Invoices can reduce inventory quantities for each line.
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
              File always downloads. Document is always saved in the app.
              {canDiscount && total > 0 ? ` · Total ${currency(total)}` : ""}
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
              onClick={() => void runExport(true)}
            >
              Create & close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
