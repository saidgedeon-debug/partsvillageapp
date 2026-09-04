import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PackagePlus, Wrench } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/app/cart-context";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { useFleet } from "@/components/app/fleet-context";
import { useInventory } from "@/components/app/inventory-context";
import { useKits } from "@/components/app/kits-context";
import { useParties } from "@/components/app/parties-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addKitPartsToCart, kitsForMachine } from "@/lib/cross-sell";
import { currency } from "@/lib/mock-data";

export const Route = createFileRoute("/fleet/$machineId")({
  head: () => ({
    meta: [{ title: "Machine history — Parts Village" }],
  }),
  component: MachineHistoryPage,
});

function MachineHistoryPage() {
  const { machineId } = Route.useParams();
  const { machines, ordersByMachine } = useFleet();
  const { clients } = useParties();
  const { documents } = useDocuments();
  const { kits } = useKits();
  const { getPart } = useInventory();
  const { addPart, setDocumentKind, documentKind, setCartOpen, setCartParty } = useCart();

  const machine = machines.find((m) => m.id === machineId);
  const client = clients.find((c) => c.id === machine?.clientId);
  const fleetOrders = ordersByMachine(machineId);

  const matchedKits = useMemo(() => {
    if (!machine) return [];
    return kitsForMachine(kits, machine.make, machine.model);
  }, [kits, machine]);

  const timeline = useMemo(() => {
    const rows: {
      key: string;
      date: string;
      docId: string;
      partNumber: string;
      name: string;
      qty: number;
      amount: number;
    }[] = [];
    const seen = new Set<string>();

    for (const order of fleetOrders) {
      for (const line of order.lines ?? []) {
        const key = `ord-${order.id}-${line.partId}-${line.partNumber}`;
        const dedupe = `${order.documentId || order.id}-${line.partNumber}-${line.qty}`;
        seen.add(dedupe);
        rows.push({
          key,
          date: order.date,
          docId: order.documentId || order.id,
          partNumber: line.partNumber,
          name: line.name,
          qty: Number(line.qty) || 0,
          amount: (Number(line.unitPrice) || 0) * (Number(line.qty) || 0),
        });
      }
    }

    const docIds = new Set(
      fleetOrders.map((o) => o.documentId).filter(Boolean) as string[],
    );
    for (const doc of documents) {
      if (doc.kind !== "invoice" || !docIds.has(doc.id)) continue;
      for (const line of doc.lines ?? []) {
        const dedupe = `${doc.id}-${line.partNumber}-${line.qty}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        rows.push({
          key: `inv-${doc.id}-${line.partId}-${line.partNumber}`,
          date: doc.date,
          docId: doc.id,
          partNumber: line.partNumber,
          name: line.name,
          qty: Number(line.qty) || 0,
          amount: (Number(line.unitPrice) || 0) * (Number(line.qty) || 0),
        });
      }
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.docId.localeCompare(a.docId));
  }, [documents, fleetOrders]);

  if (!machine) {
    return (
      <main className="p-6">
        <EmptyState
          icon={Wrench}
          title="Machine not found"
          description="This fleet machine may have been removed."
        />
        <Button asChild variant="outline" className="mt-4 gap-1.5">
          <Link to="/fleet">
            <ArrowLeft className="h-4 w-4" />
            Back to fleet
          </Link>
        </Button>
      </main>
    );
  }

  const sellKit = (kitId: string) => {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    if (!documentKind) setDocumentKind("invoice");
    if (client) setCartParty(client.id, client.name);
    const n = addKitPartsToCart(kit, getPart, addPart);
    setCartOpen(true);
    toast.success(
      n > 0
        ? `Added ${n} parts from “${kit.name}”`
        : `No stocked parts found for “${kit.name}”`,
    );
  };

  return (
    <>
      <PageHeader
        title={`${machine.make} ${machine.model}`}
        subtitle={`${client?.name ?? "Client"} · serial ${machine.serialNumber || "—"} · every part sold for this machine`}
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/fleet">
              <ArrowLeft className="h-4 w-4" />
              Fleet
            </Link>
          </Button>
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {fleetOrders.length} order link{fleetOrders.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline">
            {timeline.length} line{timeline.length === 1 ? "" : "s"}
          </Badge>
          {machine.year ? <Badge variant="outline">{machine.year}</Badge> : null}
        </div>

        {matchedKits.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PackagePlus className="h-4 w-4" />
                Sell kit
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {matchedKits.map((kit) => (
                <Button
                  key={kit.id}
                  type="button"
                  variant="secondary"
                  onClick={() => sellKit(kit.id)}
                >
                  {kit.name} ({kit.lines.length} parts)
                </Button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Part</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeline.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No linked sales yet — checkout with this machine selected to build history.
                    </TableCell>
                  </TableRow>
                ) : (
                  timeline.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="font-mono text-xs">{row.docId}</TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{row.partNumber}</div>
                        <div className="text-xs text-muted-foreground">{row.name}</div>
                      </TableCell>
                      <TableCell className="text-right">{row.qty}</TableCell>
                      <TableCell className="text-right">{currency(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
