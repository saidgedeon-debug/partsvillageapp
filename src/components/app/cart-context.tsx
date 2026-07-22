import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useCloudState } from "@/lib/cloud-store";
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

type CartStored = {
  documentKind: DocumentKind | null;
  lines: CartLine[];
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
  updateLinePrice: (partId: string, unitPrice: number) => void;
  updateLineCost: (partId: string, unitCost: number) => void;
  removeLine: (partId: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "parts-village-cart-v1";

const CartContext = createContext<CartContextValue | null>(null);

function emptyCart(): CartStored {
  return { documentKind: null, lines: [] };
}

function isCartEmpty(v: CartStored): boolean {
  return v.documentKind == null && (v.lines?.length ?? 0) === 0;
}

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
  const { value: store, setValue: setStore } = useCloudState<CartStored>(
    "cart",
    STORAGE_KEY,
    emptyCart(),
    isCartEmpty,
  );
  const documentKind = store.documentKind ?? null;
  const lines = store.lines ?? [];
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingPart, setPendingPart] = useState<Part | null>(null);

  const setDocumentKind = useCallback(
    (kind: DocumentKind | null) => {
      setStore((prev) => ({ ...prev, documentKind: kind }));
    },
    [setStore],
  );

  const addPart = useCallback(
    (part: Part, qty = 1) => {
      setStore((prev) => {
        const existing = (prev.lines ?? []).find((l) => l.partId === part.id);
        const lines = existing
          ? (prev.lines ?? []).map((l) => (l.partId === part.id ? { ...l, qty: l.qty + qty } : l))
          : [...(prev.lines ?? []), partToLine(part, qty)];
        return { documentKind: prev.documentKind ?? null, lines };
      });
    },
    [setStore],
  );

  const askDocumentForPart = useCallback(
    (part: Part) => {
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
    [addPart, pendingPart, setDocumentKind],
  );

  const updateQty = useCallback(
    (partId: string, qty: number) => {
      setStore((prev) => ({
        ...prev,
        lines: prev.lines
          .map((l) => (l.partId === partId ? { ...l, qty } : l))
          .filter((l) => l.qty > 0),
      }));
    },
    [setStore],
  );

  const updateLinePrice = useCallback(
    (partId: string, unitPrice: number) => {
      setStore((prev) => ({
        ...prev,
        lines: prev.lines.map((l) =>
          l.partId === partId
            ? { ...l, unitPrice: Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0 }
            : l,
        ),
      }));
    },
    [setStore],
  );

  const updateLineCost = useCallback(
    (partId: string, unitCost: number) => {
      setStore((prev) => ({
        ...prev,
        lines: prev.lines.map((l) =>
          l.partId === partId
            ? { ...l, unitCost: Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0 }
            : l,
        ),
      }));
    },
    [setStore],
  );

  const removeLine = useCallback(
    (partId: string) => {
      setStore((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.partId !== partId) }));
    },
    [setStore],
  );

  const clearCart = useCallback(() => {
    setStore((prev) => ({ ...prev, documentKind: null, lines: [] }));
    setCheckoutOpen(false);
  }, [setStore]);

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
      updateLinePrice,
      updateLineCost,
      removeLine,
      clearCart,
    }),
    [
      documentKind,
      setDocumentKind,
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
      updateLinePrice,
      updateLineCost,
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
