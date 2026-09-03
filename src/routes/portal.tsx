import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
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
import {
  fetchPortalStatement,
  type PortalStatementPayload,
} from "@/lib/operator-auth-server";
import { currency } from "@/lib/mock-data";

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
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PortalStatementPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!clientId || !token) {
      setLoading(false);
      setError("missing");
      return;
    }
    setLoading(true);
    void fetchPortalStatement({ data: { clientId, token } })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          setPayload(null);
        } else {
          setPayload(result);
          setError(null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, token]);

  if (!clientId || !token || error === "missing") {
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

  if (loading) {
    return (
      <>
        <PageHeader title="Account" subtitle="Parts Village client portal" />
        <main className="flex flex-1 items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  if (error || !payload) {
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

  const { client, statement, openQuotes } = payload;

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
                    <TableRow key={row.invoiceId}>
                      <TableCell className="font-mono text-xs">{row.invoiceId}</TableCell>
                      <TableCell>{row.date}</TableCell>
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
      <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground md:px-6">
        Questions? WhatsApp Parts Village
      </footer>
    </>
  );
}
