import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users, ChevronRight, Truck } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clients, machinesByClient, ordersByClient } from "@/lib/mock-data";

export const Route = createFileRoute("/clients/")({
  head: () => ({
    meta: [
      { title: "Clients CRM — Parts Village" },
      { name: "description", content: "Client directory with contact information and active fleet." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { query } = useSearch();
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!q) return clients;
    return clients.filter((c) => {
      const fleet = machinesByClient(c.id);
      return (
        c.name.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        fleet.some((m) => m.serialNumber.toLowerCase().includes(q) || `${m.make} ${m.model}`.toLowerCase().includes(q))
      );
    });
  }, [q]);

  return (
    <>
      <PageHeader title="Clients CRM" subtitle={`${rows.length} of ${clients.length} clients`} />
      <main className="flex-1 space-y-3 p-4 md:p-6">
        {rows.map((c) => {
          const fleet = machinesByClient(c.id);
          const orderCount = ordersByClient(c.id).length;
          return (
            <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }} className="block">
              <Card className="transition hover:border-accent/60 hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">{c.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{orderCount} orders</Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.contactName} · {c.email} · {c.phone}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 md:flex">
                    <Truck className="h-4 w-4 text-accent" />
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fleet.length} machines</p>
                      <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {fleet.map((m) => `${m.make} ${m.model}`).join(", ")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">No clients match “{query}”.</div>
        )}
      </main>
    </>
  );
}