import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { useParties, type PartyRecord } from "@/components/app/parties-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Kind = "client" | "supplier";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  /** When set, dialog edits this party; otherwise creates new. */
  party?: PartyRecord | null;
  onSaved?: (party: PartyRecord) => void;
};

const empty = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

export function PartyFormDialog({ open, onOpenChange, kind, party, onSaved }: Props) {
  const { addClient, addSupplier, updateClient, updateSupplier } = useParties();
  const [form, setForm] = useState(empty);
  const editing = Boolean(party);
  const label = kind === "client" ? "client" : "supplier";

  useEffect(() => {
    if (!open) return;
    if (party) {
      setForm({
        name: party.name,
        contactName: party.contactName,
        email: party.email,
        phone: party.phone,
        address: party.address,
        notes: party.notes ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [open, party]);

  const set =
    (key: keyof typeof empty) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () => {
    if (!form.name.trim()) {
      toast.error(`Enter a ${label} name`);
      return;
    }
    const payload = {
      name: form.name,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone,
      address: form.address,
      notes: form.notes,
    };
    const saved =
      kind === "client"
        ? editing && party
          ? updateClient(party.id, payload)!
          : addClient(payload)
        : editing && party
          ? updateSupplier(party.id, payload)!
          : addSupplier(payload);

    toast.success(editing ? `${label} updated` : `${label} created`);
    onOpenChange(false);
    onSaved?.(saved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${label}` : `Add ${label}`}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update ${label} contact details.`
              : `Save a new ${label} to your CRM.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="party-name">Name *</Label>
            <Input id="party-name" value={form.name} onChange={set("name")} placeholder="Company name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="party-contact">Contact person</Label>
            <Input
              id="party-contact"
              value={form.contactName}
              onChange={set("contactName")}
              placeholder="Full name"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="party-email">Email</Label>
              <Input
                id="party-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="party-phone">Phone</Label>
              <Input
                id="party-phone"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+1 …"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="party-address">Address</Label>
            <Input
              id="party-address"
              value={form.address}
              onChange={set("address")}
              placeholder="Street, city, country"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="party-notes">Notes</Label>
            <Input
              id="party-notes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Payment terms, preferred language…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            {editing ? "Save changes" : `Create ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
