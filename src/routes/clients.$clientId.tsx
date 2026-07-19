import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Truck,
  Pencil,
  StickyNote,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useParties } from "@/components/app/parties-context";
import { useFleet } from "@/components/app/fleet-context";
import { PartyFormDialog } from "@/components/app/party-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clientById, currency } from "@/lib/mock-data";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client — Parts Village" },
      { name: "description", content: "Client fleet, machines, and full parts order history." },
    ],
  }),
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { clients } = useParties();
  const {
    machinesByClient,
    ordersByClient,
    ordersByMachine,
    addMachine,
  } = useFleet();
  const [editOpen, setEditOpen] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [hours, setHours] = useState("0");

  const client = clients.find((c) => c.id === clientId) ?? clientById(clientId);

  if (!client) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Client not found.</p>
        <Link to="/clients" className="text-accent hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const fleet = machinesByClient(client.id);
  const allOrders = ordersByClient(client.id);
  const spend = allOrders.reduce(
    (s, o) => s + o.lines.reduce((ls, l) => ls + l.qty * l.unitPrice, 0),
    0,
  );

  const saveMachine = () => {
    if (!make.trim() || !model.trim()) {
      toast.error("Enter make and model");
      return;
    }
    addMachine({
      clientId: client.id,
      make: make.trim(),
      model: model.trim(),
      serialNumber: serial.trim() || "—",
      year: Number(year) || new Date().getFullYear(),
      hours: Number(hours) || 0,
    });
    toast.success("Machine added");
    setMachineOpen(false);
    setMake("");
    setModel("");
    setSerial("");
    setYear(String(new Date().getFullYear()));
    setHours("0");
  };

  return (
    <>
      <PageHeader title={client.name} subtitle={client.contactName || "Saved client"} />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/clients">
              <ArrowLeft className="mr-1 h-4 w-4" /> All clients
            </Link>
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit details
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setMachineOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add machine
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent" />
                {client.email || "—"}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-accent" />
                {client.phone || "—"}
              </p>
              <p className="flex items-center gap-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-accent" />
                {client.address || "—"}
              </p>
              {"notes" in client && typeof client.notes === "string" && client.notes ? (
                <p className="flex items-start gap-2 md:col-span-2">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {client.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card className="border-accent/40 bg-gradient-to-br from-card to-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Lifetime Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{currency(spend)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {allOrders.length} orders · {fleet.length} machines
              </p>
            </CardContent>
          </Card>
        </div>

        {allOrders.length > 0 && fleet.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOrders.map((o) => {
                    const total = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id}</TableCell>
                        <TableCell>{o.date}</TableCell>
                        <TableCell className="text-sm">
                          {o.lines.map((l) => (
                            <div key={l.partId} className="text-muted-foreground">
                              <span className="font-mono text-xs text-foreground">
                                {l.partNumber}
                              </span>{" "}
                              — {l.name} <span className="text-xs">×{l.qty}</span>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              o.status === "Paid"
                                ? "default"
                                : o.status === "Pending"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5 text-accent" /> Fleet & Order History
          </h2>
          {fleet.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No machines linked yet. Add a machine to organize this client&apos;s fleet.
            </p>
          )}
          {fleet.map((m) => {
            const mOrders = ordersByMachine(m.id);
            const mSpend = mOrders.reduce(
              (s, o) => s + o.lines.reduce((ls, l) => ls + l.qty * l.unitPrice, 0),
              0,
            );
            return (
              <Card key={m.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {m.make} {m.model}
                    </CardTitle>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Serial {m.serialNumber} · {m.year} · {m.hours.toLocaleString()} hrs
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{currency(mSpend)}</p>
                    <p className="text-xs text-muted-foreground">{mOrders.length} orders</p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {mOrders.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No orders linked to this machine yet.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Parts</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mOrders.map((o) => {
                          const total = o.lines.reduce(
                            (s, l) => s + l.qty * l.unitPrice,
                            0,
                          );
                          return (
                            <TableRow key={o.id}>
                              <TableCell className="font-mono text-xs">{o.id}</TableCell>
                              <TableCell>{o.date}</TableCell>
                              <TableCell className="text-sm">
                                {o.lines.map((l) => (
                                  <div key={l.partId} className="text-muted-foreground">
                                    <span className="font-mono text-xs text-foreground">
                                      {l.partNumber}
                                    </span>{" "}
                                    — {l.name} <span className="text-xs">×{l.qty}</span>
                                  </div>
                                ))}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currency(total)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant={
                                    o.status === "Paid"
                                      ? "default"
                                      : o.status === "Pending"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {o.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <PartyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        kind="client"
        party={
          "contactName" in client
            ? (client as {
                id: string;
                name: string;
                contactName: string;
                email: string;
                phone: string;
                address: string;
                notes?: string;
              })
            : null
        }
      />

      <Dialog open={machineOpen} onOpenChange={setMachineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add machine</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Komatsu" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="PC200-7"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Serial</Label>
              <Input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Serial number"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Hours</Label>
              <Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMachineOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveMachine}>
              Save machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
