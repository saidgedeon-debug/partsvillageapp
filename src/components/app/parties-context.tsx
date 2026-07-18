import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { clients as seedClients } from "@/lib/mock-data";

export type PartyRecord = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
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

const PartiesContext = createContext<PartiesContextValue | null>(null);

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeParty(input: PartyInput, prefix: string, existingId?: string): PartyRecord {
  return {
    id: existingId ?? input.id ?? newId(prefix),
    name: input.name.trim(),
    contactName: (input.contactName ?? "").trim(),
    email: (input.email ?? "").trim(),
    phone: (input.phone ?? "").trim(),
    address: (input.address ?? "").trim(),
    notes: (input.notes ?? "").trim() || undefined,
  };
}

function matchesParty(p: PartyRecord, q: string) {
  if (!q) return true;
  const hay = `${p.name} ${p.contactName} ${p.email} ${p.phone} ${p.address} ${p.notes ?? ""}`.toLowerCase();
  return hay.includes(q);
}

function loadStored(): { clients: PartyRecord[]; suppliers: PartyRecord[] } {
  if (typeof window === "undefined") {
    return { clients: [], suppliers: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        clients: seedClients.map((c) => ({ ...c })),
        suppliers: [],
      };
    }
    const parsed = JSON.parse(raw) as { clients?: PartyRecord[]; suppliers?: PartyRecord[] };
    const clients = Array.isArray(parsed.clients) ? parsed.clients : [];
    const suppliers = Array.isArray(parsed.suppliers) ? parsed.suppliers : [];
    const byName = new Set(clients.map((c) => c.name.toLowerCase()));
    for (const c of seedClients) {
      if (!byName.has(c.name.toLowerCase())) clients.push({ ...c });
    }
    return { clients, suppliers };
  } catch {
    return { clients: seedClients.map((c) => ({ ...c })), suppliers: [] };
  }
}

export function PartiesProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<PartyRecord[]>([]);
  const [suppliers, setSuppliers] = useState<PartyRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const data = loadStored();
    setClients(data.clients);
    setSuppliers(data.suppliers);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clients, suppliers }));
  }, [clients, suppliers, hydrated]);

  const addClient = useCallback((input: PartyInput) => {
    const party = normalizeParty(input, "cli");
    setClients((prev) => {
      const exists = prev.find((c) => c.name.toLowerCase() === party.name.toLowerCase());
      if (exists) return prev.map((c) => (c.id === exists.id ? { ...party, id: exists.id } : c));
      return [party, ...prev];
    });
    return party;
  }, []);

  const addSupplier = useCallback((input: PartyInput) => {
    const party = normalizeParty(input, "sup");
    setSuppliers((prev) => {
      const exists = prev.find((c) => c.name.toLowerCase() === party.name.toLowerCase());
      if (exists) return prev.map((c) => (c.id === exists.id ? { ...party, id: exists.id } : c));
      return [party, ...prev];
    });
    return party;
  }, []);

  const updateClient = useCallback((id: string, input: PartyInput) => {
    const party = normalizeParty(input, "cli", id);
    setClients((prev) => prev.map((c) => (c.id === id ? party : c)));
    return party;
  }, []);

  const updateSupplier = useCallback((id: string, input: PartyInput) => {
    const party = normalizeParty(input, "sup", id);
    setSuppliers((prev) => prev.map((c) => (c.id === id ? party : c)));
    return party;
  }, []);

  const removeClient = useCallback((id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const removeSupplier = useCallback((id: string) => {
    setSuppliers((prev) => prev.filter((c) => c.id !== id));
  }, []);

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
