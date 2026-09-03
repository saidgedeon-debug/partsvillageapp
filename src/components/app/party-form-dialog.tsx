import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { useParties, type PartyRecord } from "@/components/app/parties-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizePhoneE164 } from "@/lib/phone";

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
  leadTimeDays: "",
  promisedPayDate: "",
  preferredPaymentMethod: "",
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
        leadTimeDays:
          party.leadTimeDays != null && Number.isFinite(party.leadTimeDays)
            ? String(party.leadTimeDays)
            : "",
        promisedPayDate: party.promisedPayDate ?? "",
        preferredPaymentMethod: party.preferredPaymentMethod ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [open, party]);

  const set =
    (key: keyof typeof empty) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () => {
    if (!form.name.trim()) {
      toast.error(`Enter a ${label} name`);
      return;
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    const phoneRaw = form.phone.trim();
    let phone = "";
    if (phoneRaw) {
      const normalized = normalizePhoneE164(phoneRaw);
      if (!normalized) {
        toast.error("Enter a valid mobile with country code (e.g. +961 71 000 000)");
        return;
      }
      phone = normalized;
    }
    const payload = {
      name: form.name,
      contactName: form.contactName,
      email,
      phone,
      address: form.address,
      notes: form.notes,
      leadTimeDays:
        kind === "supplier" && form.leadTimeDays.trim()
          ? Math.max(0, Math.round(Number(form.leadTimeDays)))
          : undefined,
      ...(kind === "client"
        ? {
            promisedPayDate: form.promisedPayDate.trim(),
            preferredPaymentMethod: form.preferredPaymentMethod.trim(),
          }
        : {}),
    };
    const saved =
      kind === "client"
        ? editing && party
          ? updateClient(party.id, payload)
          : addClient(payload)
        : editing && party
          ? updateSupplier(party.id, payload)
          : addSupplier(payload);

    if (!saved) {
      toast.error(`Could not update ${label} — it may have been deleted`);
      return;
    }

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
            {editing ? `Update ${label} contact details.` : `Save a new ${label} to your CRM.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="party-name">Name *</Label>
            <Input
              id="party-name"
              value={form.name}
              onChange={set("name")}
              placeholder="Company name"
            />
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
                placeholder="+961 71 000 000"
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
          {kind === "supplier" ? (
            <div className="space-y-1.5">
              <Label htmlFor="party-lead-time">Typical lead time (days)</Label>
              <Input
                id="party-lead-time"
                type="number"
                min={0}
                step={1}
                value={form.leadTimeDays}
                onChange={set("leadTimeDays")}
                placeholder="14"
              />
            </div>
          ) : null}
          {kind === "client" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="party-promised-pay">Promised pay date</Label>
                <Input
                  id="party-promised-pay"
                  type="date"
                  value={form.promisedPayDate}
                  onChange={set("promisedPayDate")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred payment</Label>
                <Select
                  value={form.preferredPaymentMethod || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      preferredPaymentMethod: v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="OMT">OMT</SelectItem>
                    <SelectItem value="Whish">Whish</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
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
