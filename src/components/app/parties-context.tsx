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
};

type PartiesContextValue = {
  clients: PartyRecord[];
  suppliers: PartyRecord[];
  addClient: (input: Partial<PartyRecord> & { name: string }) => PartyRecord;
  addSupplier: (input: Partial<PartyRecord> & { name: string }) => PartyRecord;
  searchClients: (q: string) => PartyRecord[];
  searchSuppliers: (q: string) => PartyRecord[];
};

const STORAGE_KEY = "parts-village-parties-v1";

const PartiesContext = createContext<PartiesContextValue | null>(null);

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeParty(input: Partial<PartyRecord> & { name: string }, prefix: string): PartyRecord {
  return {
    id: input.id ?? newId(prefix),
    name: input.name.trim(),
    contactName: (input.contactName ?? "").trim(),
    email: (input.email ?? "").trim(),
    phone: (input.phone ?? "").trim(),
    address: (input.address ?? "").trim(),
  };
}

function matchesParty(p: PartyRecord, q: string) {
  if (!q) return true;
  const hay = `${p.name} ${p.contactName} ${p.email} ${p.phone} ${p.address}`.toLowerCase();
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
    // Merge seed clients that aren't already saved
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

  const addClient = useCallback((input: Partial<PartyRecord> & { name: string }) => {
    const party = normalizeParty(input, "cli");
    setClients((prev) => {
      const exists = prev.find((c) => c.name.toLowerCase() === party.name.toLowerCase());
      if (exists) return prev;
      return [party, ...prev];
    });
    return party;
  }, []);

  const addSupplier = useCallback((input: Partial<PartyRecord> & { name: string }) => {
    const party = normalizeParty(input, "sup");
    setSuppliers((prev) => {
      const exists = prev.find((c) => c.name.toLowerCase() === party.name.toLowerCase());
      if (exists) return prev;
      return [party, ...prev];
    });
    return party;
  }, []);

  const searchClients = useCallback(
    (q: string) => {
      const needle = q.trim().toLowerCase();
      return clients.filter((c) => matchesParty(c, needle));
    },
    [clients],
  );

  const searchSuppliers = useCallback(
    (q: string) => {
      const needle = q.trim().toLowerCase();
      return suppliers.filter((s) => matchesParty(s, needle));
    },
    [suppliers],
  );

  const value = useMemo(
    () => ({
      clients,
      suppliers,
      addClient,
      addSupplier,
      searchClients,
      searchSuppliers,
    }),
    [clients, suppliers, addClient, addSupplier, searchClients, searchSuppliers],
  );

  return <PartiesContext.Provider value={value}>{children}</PartiesContext.Provider>;
}

export function useParties() {
  const ctx = useContext(PartiesContext);
  if (!ctx) throw new Error("useParties must be used within PartiesProvider");
  return ctx;
}
