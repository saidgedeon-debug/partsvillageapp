import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { useFleet } from "@/components/app/fleet-context";
import { PageHeader } from "@/components/app/page-header";
import { useParties } from "@/components/app/parties-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/fleet")({
  component: FleetPage,
});

function FleetPage() {
  const { machines, ordersByMachine } = useFleet();
  const { clients } = useParties();
  const [q, setQ] = useState("");

  const clientName = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "Unknown client";
  }, [clients]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = machines.map((m) => ({
      ...m,
      clientName: clientName(m.clientId),
      orderCount: ordersByMachine(m.id).length,
    }));
    if (!needle) return rows.sort((a, b) => a.clientName.localeCompare(b.clientName));
    return rows
      .filter((m) =>
        `${m.make} ${m.model} ${m.serialNumber} ${m.year} ${m.clientName}`
          .toLowerCase()
          .includes(needle),
      )
      .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
  }, [machines, q, clientName, ordersByMachine]);

  return (
    <>
      <PageHeader
        title="Fleet"
        subtitle="Search every machine by make, model, or serial — across all clients"
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Serial, make, model, or client…"
          className="max-w-md"
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={machines.length === 0 ? "No machines yet" : "No matches"}
            description={
              machines.length === 0
                ? "Add machines from a client page, then find them here by serial."
                : "Try a different serial, make, or model."
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Year</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/40">
                      <TableCell>
                        <Link
                          to="/fleet/$machineId"
                          params={{ machineId: m.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {m.make} {m.model}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.serialNumber || "—"}</TableCell>
                      <TableCell>
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: m.clientId }}
                          className="text-sm text-primary hover:underline"
                        >
                          {m.clientName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm">{m.year || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{m.hours || 0}</TableCell>
                      <TableCell className="text-right text-sm">{m.orderCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
