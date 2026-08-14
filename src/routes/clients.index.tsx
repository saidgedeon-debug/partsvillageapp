import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Users,
  ChevronRight,
  Truck,
  Plus,
  MessageCircle,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { useParties } from "@/components/app/parties-context";
import { useFleet } from "@/components/app/fleet-context";
import { useDocuments } from "@/components/app/documents-context";
import { PartyFormDialog } from "@/components/app/party-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildClientsArQueue,
  openOverdueWhatsApp,
  type ClientArSummary,
} from "@/lib/ar-statement";
import { currency } from "@/lib/mock-data";
import { statusChipClass } from "@/lib/status-styles";
import { cn } from "@/lib/utils";

type ClientsSearch = {
  owed?: boolean;
};

export const Route = createFileRoute("/clients/")({
  validateSearch: (search: Record<string, unknown>): ClientsSearch => ({
    owed: search.owed === true || search.owed === "1" || search.owed === "true",
  }),
  head: () => ({
    meta: [
      { title: "Clients CRM — Parts Village" },
      { name: "description", content: "Client directory with contact information and active fleet." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { owed: owedOnly } = Route.useSearch();
  const { query } = useSearch();
  const { clients } = useParties();
  const { invoices, creditNotes } = useDocuments();
  const { machinesByClient, ordersByClient } = useFleet();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const q = query.trim().toLowerCase();

  const arQueue = useMemo(
    () => buildClientsArQueue(clients, invoices, creditNotes),
    [clients, invoices, creditNotes],
  );

  const arByClientId = useMemo(() => {
    const map = new Map<string, ClientArSummary>();
    for (const row of arQueue) map.set(row.client.id, row);
    return map;
  }, [arQueue]);

  const arTotal = useMemo(
    () => arQueue.reduce((sum, row) => sum + row.statement.total, 0),
    [arQueue],
  );

  const rows = useMemo(() => {
    const base = owedOnly ? arQueue.map((row) => row.client) : clients;
    if (!q) return base;
    return base.filter((c) => {
      const fleet = machinesByClient(c.id);
      return (
        c.name.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q) ||
        fleet.some(
          (m) =>
            m.serialNumber.toLowerCase().includes(q) ||
            `${m.make} ${m.model}`.toLowerCase().includes(q),
        )
      );
    });
  }, [q, clients, machinesByClient, owedOnly, arQueue]);

  const setOwedOnly = (next: boolean) => {
    void navigate({
      to: "/clients",
      search: next ? { owed: true } : {},
      replace: true,
    });
  };

  return (
    <>
      <PageHeader
        title="Clients CRM"
        subtitle={
          owedOnly
            ? `${rows.length} client${rows.length === 1 ? "" : "s"} with open balance · ${currency(arTotal)} due`
            : `${rows.length} of ${clients.length} clients`
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant={owedOnly ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setOwedOnly(!owedOnly)}
          >
            <Wallet className="h-4 w-4" />
            Who owes me
            {arQueue.length > 0 ? (
              <Badge
                variant={owedOnly ? "secondary" : "outline"}
                className="ml-0.5 font-semibold tabular-nums"
              >
                {arQueue.length} · {currency(arTotal)}
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-0.5">
                0
              </Badge>
            )}
          </Button>
          <Button type="button" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add client
          </Button>
        </div>

        {!owedOnly && arQueue.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Who owes me</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {arQueue.length} client{arQueue.length === 1 ? "" : "s"} · total{" "}
                    {currency(arTotal)} open
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setOwedOnly(true)}>
                  See all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {arQueue.slice(0, 8).map(({ client, statement }) => (
                <div
                  key={client.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <Link
                    to="/clients/$clientId"
                    params={{ clientId: client.id }}
                    className="min-w-0 font-medium hover:underline"
                  >
                    {client.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    {statement.days61Plus > 0 ? (
                      <span className={statusChipClass("danger")}>
                        61+ {currency(statement.days61Plus)}
                      </span>
                    ) : statement.days31To60 > 0 ? (
                      <span className={statusChipClass("warning")}>
                        31–60 {currency(statement.days31To60)}
                      </span>
                    ) : (
                      <span className={statusChipClass("info")}>
                        0–30 {currency(statement.current)}
                      </span>
                    )}
                    <span className="text-xs font-semibold">{currency(statement.total)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => openOverdueWhatsApp(client, statement)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {owedOnly && arQueue.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Open balances</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sorted by oldest / largest overdue first — WhatsApp when you need to follow up.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map((c) => {
                const ar = arByClientId.get(c.id);
                if (!ar) return null;
                const { statement } = ar;
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: c.id }}
                      className="min-w-0 font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      {statement.days61Plus > 0 ? (
                        <span className={statusChipClass("danger")}>
                          61+ {currency(statement.days61Plus)}
                        </span>
                      ) : statement.days31To60 > 0 ? (
                        <span className={statusChipClass("warning")}>
                          31–60 {currency(statement.days31To60)}
                        </span>
                      ) : (
                        <span className={statusChipClass("info")}>
                          0–30 {currency(statement.current)}
                        </span>
                      )}
                      <span className="text-sm font-semibold">{currency(statement.total)}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openOverdueWhatsApp(c, statement)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link to="/clients/$clientId" params={{ clientId: c.id }}>
                          Open
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {!owedOnly
          ? rows.map((c) => {
              const fleet = machinesByClient(c.id);
              const orderCount = ordersByClient(c.id).length;
              const ar = arByClientId.get(c.id);
              return (
                <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }} className="block">
                  <Card className="transition hover:border-primary/40 hover:shadow-md">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-foreground">{c.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {orderCount} orders
                          </Badge>
                          {ar ? (
                            <Badge
                              className={cn(
                                "text-xs font-semibold",
                                ar.statement.days61Plus > 0
                                  ? "bg-destructive/15 text-destructive"
                                  : ar.statement.days31To60 > 0
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                    : "bg-sky-500/15 text-sky-700 dark:text-sky-400",
                              )}
                            >
                              Owes {currency(ar.statement.total)}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {[c.contactName, c.email, c.phone].filter(Boolean).join(" · ") ||
                            "No contact yet — open to add details"}
                        </p>
                      </div>
                      <div className="hidden items-center gap-2 md:flex">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <div className="text-right">
                          <p className="text-sm font-semibold">{fleet.length} machines</p>
                          <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {fleet.map((m) => `${m.make} ${m.model}`).join(", ") || "—"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          : null}

        {rows.length === 0 && (
          <EmptyState
            icon={owedOnly ? Wallet : Users}
            title={
              owedOnly
                ? "Nobody owes you right now"
                : clients.length === 0
                  ? "No clients yet"
                  : `No clients match “${query}”`
            }
            description={
              owedOnly
                ? "All invoices are paid or there are no open balances."
                : clients.length === 0
                  ? "Add your first client to track contacts and fleet."
                  : "Try a different search."
            }
            action={
              owedOnly ? (
                <Button type="button" variant="outline" onClick={() => setOwedOnly(false)}>
                  Show all clients
                </Button>
              ) : clients.length === 0 ? (
                <Button type="button" onClick={() => setAddOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add first client
                </Button>
              ) : null
            }
          />
        )}
      </main>

      <PartyFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        kind="client"
        onSaved={(party) =>
          void navigate({ to: "/clients/$clientId", params: { clientId: party.id } })
        }
      />
    </>
  );
}
