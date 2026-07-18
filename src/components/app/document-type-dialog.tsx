import { FileText, Receipt, PackageSearch, X } from "lucide-react";
import { toast } from "sonner";

import { useCart, type DocumentKind } from "@/components/app/cart-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const options: { kind: DocumentKind; label: string; hint: string; icon: typeof FileText }[] = [
  { kind: "quotation", label: "Quotation", hint: "Price quote for a client", icon: FileText },
  { kind: "invoice", label: "Invoice", hint: "Bill for a client order", icon: Receipt },
  { kind: "inquiry", label: "Inquiry", hint: "Ask a supplier about stock", icon: PackageSearch },
];

export function DocumentTypeDialog() {
  const { pendingPart, clearPendingPart, confirmDocumentAndAdd } = useCart();

  const open = Boolean(pendingPart);

  const onNothing = () => {
    clearPendingPart();
    toast.message("No document created");
  };

  const onPick = (kind: DocumentKind) => {
    confirmDocumentAndAdd(kind);
    toast.success(`Started ${kind} cart`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && clearPendingPart()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a document?</DialogTitle>
          <DialogDescription>
            {pendingPart ? (
              <>
                Add <span className="font-mono font-medium text-foreground">{pendingPart.partNumber}</span>{" "}
                to a quotation, invoice, or supplier inquiry — or skip.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {options.map(({ kind, label, hint, icon: Icon }) => (
            <Button
              key={kind}
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 px-3 py-3 text-left"
              onClick={() => onPick(kind)}
            >
              <Icon className="h-5 w-5 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
              </span>
            </Button>
          ))}
          <Button type="button" variant="ghost" className="gap-2" onClick={onNothing}>
            <X className="h-4 w-4" />
            Nothing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
