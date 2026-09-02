import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { useParties } from "@/components/app/parties-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildArStatement, documentBelongsToClient } from "@/lib/ar-statement";
import { currency } from "@/lib/mock-data";
import { verifyPortalToken } from "@/lib/portal-token";

type PortalSearch = {
  c?: string;
  t?: string;
};

export const Route = createFileRoute("/portal")({
  validateSearch: (search: Record<string, unknown>): PortalSearch => ({
    c: typeof search.c === "string" ? search.c : undefined,
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Account — Parts Village" },
      { name: "description", content: "Read-only client account statement and open documents." },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const { c: clientId, t: token } = Route.useSearch();
  const { getClient } = useParties();
  const { invoices, quotations, creditNotes } = useDocuments();

  const client = clientId ? getClient(clientId) : undefined;
  const allowed =
    Boolean(client) &&
    Boolean(clientId) &&
    Boolean(token) &&
    verifyPortalToken(clientId!, token!, client?.portalToken);

  const statement = useMemo(() => {
    if (!client || !allowed) return null;
    return buildArStatement(client, invoices, creditNotes);
  }, [client, allowed, invoices, creditNotes]);

  const openQuotes = useMemo(() => {
    if (!client || !allowed) return [];
    return quotations
      .filter(
        (q) =>
          documentBelongsToClient(q, client) &&
          (q.status === "Draft" || q.status === "Sent"),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [client, allowed, quotations]);

  if (!clientId || !token) {
    return (
      <>
        <PageHeader title="Account" subtitle="Parts Village client portal" />
        <main className="flex-1 p-6">
          <p className="text-sm text-muted-foreground">
            Missing portal link. Ask Parts Village for a valid account URL.
          </p>
        </main>
      </>
    );
  }

  if (!allowed || !client || !statement) {
    return (
      <>
        <PageHeader title="Account" subtitle="Parts Village client portal" />
        <main className="flex-1 p-6">
          <p className="text-sm text-muted-foreground">
            This portal link is invalid or expired. Contact Parts Village for a new link.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={client.name} subtitle="Read-only account view" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">0–30 days</p>
                <p className="font-semibold">{currency(statement.current)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">31–60 days</p>
                <p className="font-semibold">{currency(statement.days31To60)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">61+ days</p>
                <p className="font-semibold">{currency(statement.days61Plus)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net due</p>
                <p className="font-bold text-accent">{currency(statement.netDue)}</p>
                {statement.unappliedCredits > 0.005 ? (
                  <p className="text-xs text-muted-foreground">
                    Unapplied credit −{currency(statement.unappliedCredits)}
                  </p>
                ) : null}
              </div>
            </div>
            {client.promisedPayDate ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Promised pay date: {client.promisedPayDate}
                {client.preferredPaymentMethod
                  ? ` · Preferred: ${client.preferredPaymentMethod}`
                  : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {statement.rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No open invoices.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.rows.map((row) => (
                    <TableRow key={row.invoice.id}>
                      <TableCell className="font-mono text-xs">{row.invoice.id}</TableCell>
                      <TableCell>{row.invoice.date}</TableCell>
                      <TableCell className="text-right text-xs">{row.ageDays}d</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(row.remaining)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open quotations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {openQuotes.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No open quotations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openQuotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs">{q.id}</TableCell>
                      <TableCell>{q.date}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(q.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{q.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
