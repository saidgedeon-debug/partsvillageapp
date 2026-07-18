import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { Part } from "@/lib/mock-data";

export type DocumentKind = "quotation" | "invoice" | "inquiry";
export type PartyKind = "client" | "supplier";

export type CartLine = {
  partId: string;
  partNumber: string;
  name: string;
  category: string;
  boxNumber?: number;
  insideDiameterMm?: string;
  crossSectionMm?: string;
  /** Selling price (quotations / invoices). */
  unitPrice: number;
  /** Supplier / purchase cost (inquiries). */
  unitCost: number;
  qty: number;
};

type CartContextValue = {
  documentKind: DocumentKind | null;
  setDocumentKind: (kind: DocumentKind | null) => void;
  lines: CartLine[];
  itemCount: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  checkoutOpen: boolean;
  setCheckoutOpen: (open: boolean) => void;
  pendingPart: Part | null;
  askDocumentForPart: (part: Part) => void;
  clearPendingPart: () => void;
  confirmDocumentAndAdd: (kind: DocumentKind) => void;
  addPart: (part: Part, qty?: number) => void;
  updateQty: (partId: string, qty: number) => void;
  removeLine: (partId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function partToLine(part: Part, qty = 1): CartLine {
  return {
    partId: part.id,
    partNumber: part.partNumber,
    name: part.name,
    category: part.category,
    boxNumber: part.boxNumber,
    insideDiameterMm: part.insideDiameterMm,
    crossSectionMm: part.crossSectionMm,
    unitPrice: part.price,
    unitCost: part.cost,
    qty,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [documentKind, setDocumentKind] = useState<DocumentKind | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingPart, setPendingPart] = useState<Part | null>(null);

  const addPart = useCallback((part: Part, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.partId === part.id);
      if (existing) {
        return prev.map((l) =>
          l.partId === part.id ? { ...l, qty: l.qty + qty } : l,
        );
      }
      return [...prev, partToLine(part, qty)];
    });
  }, []);

  const askDocumentForPart = useCallback(
    (part: Part) => {
      // After the first document type is chosen, later clicks go straight into the cart
      if (documentKind) {
        addPart(part, 1);
        setCartOpen(true);
        toast.success(`Added ${part.partNumber} to cart`);
        return;
      }
      setPendingPart(part);
    },
    [addPart, documentKind],
  );

  const clearPendingPart = useCallback(() => setPendingPart(null), []);

  const confirmDocumentAndAdd = useCallback(
    (kind: DocumentKind) => {
      if (!pendingPart) return;
      setDocumentKind(kind);
      addPart(pendingPart, 1);
      setPendingPart(null);
      setCartOpen(true);
    },
    [addPart, pendingPart],
  );

  const updateQty = useCallback((partId: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.partId === partId ? { ...l, qty } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const removeLine = useCallback((partId: string) => {
    setLines((prev) => prev.filter((l) => l.partId !== partId));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setDocumentKind(null);
    setCheckoutOpen(false);
  }, []);

  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);

  const value = useMemo(
    () => ({
      documentKind,
      setDocumentKind,
      lines,
      itemCount,
      cartOpen,
      setCartOpen,
      checkoutOpen,
      setCheckoutOpen,
      pendingPart,
      askDocumentForPart,
      clearPendingPart,
      confirmDocumentAndAdd,
      addPart,
      updateQty,
      removeLine,
      clearCart,
    }),
    [
      documentKind,
      lines,
      itemCount,
      cartOpen,
      checkoutOpen,
      pendingPart,
      askDocumentForPart,
      clearPendingPart,
      confirmDocumentAndAdd,
      addPart,
      updateQty,
      removeLine,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
