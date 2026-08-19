import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Package, Search, Ship, Users } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { useDocuments } from "@/components/app/documents-context";
import { useInventory } from "@/components/app/inventory-context";
import { PageHeader } from "@/components/app/page-header";
import { useParties } from "@/components/app/parties-context";
import { useSearch } from "@/components/app/search-context";
import { useShipments } from "@/components/app/shipments-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { partNumbersOf } from "@/lib/mock-data";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: GlobalSearchPage,
});

function GlobalSearchPage() {
  const { q: routeQuery } = Route.useSearch();
  const { query, setQuery } = useSearch();
  const q = (routeQuery || query).trim().toLowerCase();
  const { parts } = useInventory();
  const { clients, suppliers } = useParties();
  const { documents } = useDocuments();
  const { shipments } = useShipments();

  const partResults = q
    ? parts
        .filter((part) =>
          `${partNumbersOf(part).join(" ")} ${part.name} ${part.category}`
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 20)
    : [];
  const partyResults = q
    ? [
        ...clients.map((party) => ({ ...party, kind: "client" as const })),
        ...suppliers.map((party) => ({ ...party, kind: "supplier" as const })),
      ]
        .filter((party) => `${party.name} ${party.phone} ${party.email}`.toLowerCase().includes(q))
        .slice(0, 20)
    : [];
  const documentResults = q
    ? documents
        .filter((doc) =>
          `${doc.id} ${doc.partyName} ${doc.lines.map((l) => l.partNumber).join(" ")}`
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 20)
    : [];
  const shipmentResults = q
    ? shipments
        .filter((shipment) =>
          `${shipment.title} ${shipment.supplier} ${shipment.trackingNumber ?? ""} ${shipment.containerNo ?? ""}`
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 20)
    : [];

  return (
    <>
      <PageHeader
        title="Search everywhere"
        subtitle={q ? `Results for “${routeQuery || query}”` : "Search all shop records"}
      />
      <main className="grid flex-1 gap-4 p-4 md:grid-cols-2 md:p-6">
        {!q ? (
          <div className="col-span-full">
            <EmptyState
              icon={Search}
              title="Type to search"
              description="Use the search bar above to find parts, clients, suppliers, documents, and shipments."
            />
          </div>
        ) : (
          <>
            {partResults.length > 0 ? (
              <ResultCard icon={Package} title={`Parts (${partResults.length})`}>
                {partResults.map((part) => (
                  <Link
                    key={part.id}
                    to="/inventory"
                    onClick={() => setQuery(part.partNumber)}
                    className="block border-b py-2 last:border-0"
                  >
                    <span className="font-mono text-sm font-semibold">{part.partNumber}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{part.name}</span>
                  </Link>
                ))}
              </ResultCard>
            ) : null}
            {partyResults.length > 0 ? (
              <ResultCard icon={Users} title={`Clients & suppliers (${partyResults.length})`}>
                {partyResults.map((party) => (
                  <Link
                    key={`${party.kind}-${party.id}`}
                    to={party.kind === "client" ? "/clients/$clientId" : "/suppliers/$supplierId"}
                    params={party.kind === "client" ? { clientId: party.id } : { supplierId: party.id }}
                    className="block border-b py-2 last:border-0"
                  >
                    <p className="text-sm font-medium">{party.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {party.kind} · {party.phone || party.email || "No contact"}
                    </p>
                  </Link>
                ))}
              </ResultCard>
            ) : null}
            {documentResults.length > 0 ? (
              <ResultCard icon={FileText} title={`Documents (${documentResults.length})`}>
                {documentResults.map((doc) => (
                  <Link
                    key={doc.id}
                    to="/documents"
                    search={{
                      tab:
                        doc.kind === "invoice"
                          ? "invoices"
                          : doc.kind === "receipt"
                            ? "receipts"
                            : doc.kind === "inquiry"
                              ? "inquiries"
                              : "quotations",
                    }}
                    onClick={() => setQuery(doc.id)}
                    className="block border-b py-2 last:border-0"
                  >
                    <span className="font-mono text-xs font-semibold">{doc.id}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{doc.partyName}</span>
                  </Link>
                ))}
              </ResultCard>
            ) : null}
            {shipmentResults.length > 0 ? (
              <ResultCard icon={Ship} title={`Shipments (${shipmentResults.length})`}>
                {shipmentResults.map((shipment) => (
                  <Link
                    key={shipment.id}
                    to="/china-shipments"
                    onClick={() => setQuery(shipment.title)}
                    className="block border-b py-2 last:border-0"
                  >
                    <p className="text-sm font-medium">{shipment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {shipment.status} ·{" "}
                      {shipment.trackingNumber || shipment.containerNo || "No tracking"}
                    </p>
                  </Link>
                ))}
              </ResultCard>
            ) : null}
            {partResults.length +
              partyResults.length +
              documentResults.length +
              shipmentResults.length ===
            0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description={`Nothing matched “${routeQuery || query}”.`}
                />
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

function ResultCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Package;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
