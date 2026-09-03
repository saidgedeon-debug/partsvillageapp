import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { useCloudState } from "@/lib/cloud-store";
import { clients as seedClients } from "@/lib/mock-data";

export type PartyRecord = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  /** Typical supplier lead time; unused for clients. */
  leadTimeDays?: number;
  /** Promised payment date (ISO date string). */
  promisedPayDate?: string;
  preferredPaymentMethod?: "OMT" | "Whish" | "Cash" | string;
  /** Opaque token for client portal access. */
  portalToken?: string;
  /** ISO date (YYYY-MM-DD or full ISO) when portalToken stops working. */
  portalTokenExpiresAt?: string;
};

type PartyInput = Partial<PartyRecord> & { name: string };

type PartiesContextValue = {
  clients: PartyRecord[];
  suppliers: PartyRecord[];
  addClient: (input: PartyInput) => PartyRecord;
  addSupplier: (input: PartyInput) => PartyRecord;
  updateClient: (id: string, input: PartyInput) => PartyRecord | null;
  updateSupplier: (id: string, input: PartyInput) => PartyRecord | null;
  removeClient: (id: string) => void;
  removeSupplier: (id: string) => void;
  searchClients: (q: string) => PartyRecord[];
  searchSuppliers: (q: string) => PartyRecord[];
  getClient: (id: string) => PartyRecord | undefined;
  getSupplier: (id: string) => PartyRecord | undefined;
};

const STORAGE_KEY = "parts-village-parties-v1";

const SEED_SUPPLIERS: PartyRecord[] = [
  {
    id: "sup-kafu",
    name: "Kafu Engineering Machine Fitting Co., Ltd.",
    contactName: "",
    email: "kafu2009@163.com",
    phone: "0086-18988918836",
    address:
      "No. 221, The 2nd Street, Guangzhou International Machinery Parts Center, NO. 36, Zhuji Road, Tianhe District, Guangzhou",
    notes: "Catalog 2025 · www.kafu08.com · WhatsApp 0086-18102782293",
  },
];

type PartiesStored = { clients: PartyRecord[]; suppliers: PartyRecord[] };

function emptyParties(): PartiesStored {
  return { clients: [], suppliers: [] };
}

function isPartiesEmpty(v: PartiesStored): boolean {
  return (v.clients?.length ?? 0) === 0 && (v.suppliers?.length ?? 0) === 0;
}

function seedDefaults(): PartiesStored {
  return {
    clients: seedClients.map((c) => ({ ...c })),
    suppliers: SEED_SUPPLIERS.map((s) => ({ ...s })),
  };
}

const PartiesContext = createContext<PartiesContextValue | null>(null);

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeParty(
  input: PartyInput,
  prefix: string,
  existing?: PartyRecord,
): PartyRecord {
  const promisedPayDate =
    input.promisedPayDate !== undefined
      ? input.promisedPayDate.trim() || undefined
      : existing?.promisedPayDate;
  const preferredPaymentMethod =
    input.preferredPaymentMethod !== undefined
      ? input.preferredPaymentMethod.trim() || undefined
      : existing?.preferredPaymentMethod;
  const portalToken =
    input.portalToken !== undefined
      ? input.portalToken.trim() || undefined
      : existing?.portalToken;
  const portalTokenExpiresAt =
    input.portalTokenExpiresAt !== undefined
      ? input.portalTokenExpiresAt.trim() || undefined
      : existing?.portalTokenExpiresAt;

  return {
    id: existing?.id ?? input.id ?? newId(prefix),
    name: input.name.trim(),
    contactName: (input.contactName ?? "").trim(),
    email: (input.email ?? "").trim(),
    phone: (input.phone ?? "").trim(),
    address: (input.address ?? "").trim(),
    notes: (input.notes ?? "").trim() || undefined,
    leadTimeDays:
      Number.isFinite(input.leadTimeDays) && Number(input.leadTimeDays) >= 0
        ? Math.round(Number(input.leadTimeDays))
        : undefined,
    promisedPayDate,
    preferredPaymentMethod,
    portalToken,
    portalTokenExpiresAt,
  };
}

function matchesParty(p: PartyRecord, q: string) {
  if (!q) return true;
  const hay =
    `${p.name} ${p.contactName} ${p.email} ${p.phone} ${p.address} ${p.notes ?? ""}`.toLowerCase();
  return hay.includes(q);
}

export function PartiesProvider({ children }: { children: ReactNode }) {
  const {
    value: store,
    setValue: setStore,
    ready,
  } = useCloudState<PartiesStored>("parties", STORAGE_KEY, emptyParties(), isPartiesEmpty);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!ready || seededRef.current) return;
    seededRef.current = true;
    if (isPartiesEmpty(store)) {
      setStore(seedDefaults());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when cloud finishes loading
  }, [ready]);

  const clients = store.clients ?? [];
  const suppliers = store.suppliers ?? [];

  const addClient = useCallback(
    (input: PartyInput) => {
      let party: PartyRecord | null = null;
      setStore((prev) => {
        const exists = (prev.clients ?? []).find(
          (c) => c.name.toLowerCase() === input.name.trim().toLowerCase(),
        );
        party = normalizeParty(input, "cli", exists);
        const clients = exists
          ? (prev.clients ?? []).map((c) => (c.id === exists.id ? party! : c))
          : [party!, ...(prev.clients ?? [])];
        return { clients, suppliers: prev.suppliers ?? [] };
      });
      return party!;
    },
    [setStore],
  );

  const addSupplier = useCallback(
    (input: PartyInput) => {
      let party: PartyRecord | null = null;
      setStore((prev) => {
        const exists = (prev.suppliers ?? []).find(
          (c) => c.name.toLowerCase() === input.name.trim().toLowerCase(),
        );
        party = normalizeParty(input, "sup", exists);
        const suppliers = exists
          ? (prev.suppliers ?? []).map((c) => (c.id === exists.id ? party! : c))
          : [party!, ...(prev.suppliers ?? [])];
        return { clients: prev.clients ?? [], suppliers };
      });
      return party!;
    },
    [setStore],
  );

  const updateClient = useCallback(
    (id: string, input: PartyInput) => {
      let found = false;
      let party: PartyRecord | null = null;
      setStore((prev) => {
        const clients = prev.clients ?? [];
        const existing = clients.find((c) => c.id === id);
        if (!existing) return prev;
        found = true;
        party = normalizeParty(input, "cli", existing);
        return {
          clients: clients.map((c) => (c.id === id ? party! : c)),
          suppliers: prev.suppliers ?? [],
        };
      });
      return found ? party : null;
    },
    [setStore],
  );

  const updateSupplier = useCallback(
    (id: string, input: PartyInput) => {
      let found = false;
      let party: PartyRecord | null = null;
      setStore((prev) => {
        const suppliers = prev.suppliers ?? [];
        const existing = suppliers.find((c) => c.id === id);
        if (!existing) return prev;
        found = true;
        party = normalizeParty(input, "sup", existing);
        return {
          clients: prev.clients ?? [],
          suppliers: suppliers.map((c) => (c.id === id ? party! : c)),
        };
      });
      return found ? party : null;
    },
    [setStore],
  );

  const removeClient = useCallback(
    (id: string) => {
      setStore((prev) => ({
        clients: (prev.clients ?? []).filter((c) => c.id !== id),
        suppliers: prev.suppliers ?? [],
      }));
    },
    [setStore],
  );

  const removeSupplier = useCallback(
    (id: string) => {
      setStore((prev) => ({
        clients: prev.clients ?? [],
        suppliers: (prev.suppliers ?? []).filter((c) => c.id !== id),
      }));
    },
    [setStore],
  );

  const searchClients = useCallback(
    (q: string) => clients.filter((c) => matchesParty(c, q.trim().toLowerCase())),
    [clients],
  );

  const searchSuppliers = useCallback(
    (q: string) => suppliers.filter((s) => matchesParty(s, q.trim().toLowerCase())),
    [suppliers],
  );

  const getClient = useCallback((id: string) => clients.find((c) => c.id === id), [clients]);
  const getSupplier = useCallback((id: string) => suppliers.find((s) => s.id === id), [suppliers]);

  const value = useMemo(
    () => ({
      clients,
      suppliers,
      addClient,
      addSupplier,
      updateClient,
      updateSupplier,
      removeClient,
      removeSupplier,
      searchClients,
      searchSuppliers,
      getClient,
      getSupplier,
    }),
    [
      clients,
      suppliers,
      addClient,
      addSupplier,
      updateClient,
      updateSupplier,
      removeClient,
      removeSupplier,
      searchClients,
      searchSuppliers,
      getClient,
      getSupplier,
    ],
  );

  return <PartiesContext.Provider value={value}>{children}</PartiesContext.Provider>;
}

export function useParties() {
  const ctx = useContext(PartiesContext);
  if (!ctx) throw new Error("useParties must be used within PartiesProvider");
  return ctx;
}
