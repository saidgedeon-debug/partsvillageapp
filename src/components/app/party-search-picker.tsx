import { useMemo, useState } from "react";
import { Check, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useParties, type PartyRecord } from "@/components/app/parties-context";
import type { PartyKind } from "@/components/app/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  kind: PartyKind;
  selectedName: string;
  onSelect: (party: PartyRecord) => void;
};

export function PartySearchPicker({ kind, selectedName, onSelect }: Props) {
  const { searchClients, searchSuppliers, addClient, addSupplier } = useParties();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const label = kind === "client" ? "client" : "supplier";
  const results = useMemo(() => {
    return kind === "client" ? searchClients(query) : searchSuppliers(query);
  }, [kind, query, searchClients, searchSuppliers]);

  const exactExists = results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  const startCreate = (preset = "") => {
    setCreating(true);
    setNewName(preset || query.trim());
    setNewContact("");
    setNewEmail("");
    setNewPhone("");
  };

  const saveNew = () => {
    const name = newName.trim();
    if (!name) {
      toast.error(`Enter a ${label} name`);
      return;
    }
    const party =
      kind === "client"
        ? addClient({ name, contactName: newContact, email: newEmail, phone: newPhone })
        : addSupplier({ name, contactName: newContact, email: newEmail, phone: newPhone });
    onSelect(party);
    setQuery("");
    setCreating(false);
    toast.success(`Saved ${label}: ${party.name}`);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <Label className="text-xs">
        Search saved {label}s or create new
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCreating(false);
          }}
          placeholder={`Search ${label} name, contact, email…`}
          className="h-10 pl-9"
          autoComplete="off"
        />
      </div>

      <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background">
        {results.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No saved {label}s{query.trim() ? ` match “${query.trim()}”` : " yet"}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((p) => {
              const selected = selectedName === p.name;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
                      selected && "bg-accent/10",
                    )}
                    onClick={() => {
                      onSelect(p);
                      setQuery("");
                      setCreating(false);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{p.name}</span>
                      {(p.contactName || p.email || p.phone) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.contactName, p.email, p.phone].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!creating ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => startCreate()}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Create new {label}
          </Button>
          {query.trim() && !exactExists && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => startCreate(query.trim())}
            >
              <Plus className="h-3.5 w-3.5" />
              Create “{query.trim()}”
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-md border border-dashed border-border bg-background p-3">
          <p className="text-xs font-medium text-foreground">New {label}</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`${label === "client" ? "Client" : "Supplier"} name *`}
            className="h-9"
          />
          <Input
            value={newContact}
            onChange={(e) => setNewContact(e.target.value)}
            placeholder="Contact name (optional)"
            className="h-9"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email (optional)"
              className="h-9"
            />
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={saveNew}>
              <Plus className="h-3.5 w-3.5" />
              Save {label}
            </Button>
          </div>
        </div>
      )}

      {selectedName && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selectedName}</span>
        </p>
      )}
    </div>
  );
}
