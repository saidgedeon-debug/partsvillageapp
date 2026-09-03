import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useDocuments } from "@/components/app/documents-context";
import { useParties } from "@/components/app/parties-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildArStatement,
  openOverdueWhatsApp,
} from "@/lib/ar-statement";
import { localTodayIso } from "@/lib/date-local";
import { currency } from "@/lib/mock-data";
import { normalizePhoneE164 } from "@/lib/phone";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "Promise pay chase — Parts Village" },
      { name: "description", content: "Overdue AR and promised-pay clients for WhatsApp follow-up." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { clients } = useParties();
  const { invoices, creditNotes } = useDocuments();
  const today = localTodayIso();

  const rows = useMemo(() => {
    return clients
      .map((client) => {
        const statement = buildArStatement(client, invoices, creditNotes);
        const overdue = statement.days31To60 + statement.days61Plus;
        const promised = (client.promisedPayDate ?? "").trim();
        const promisedOverdue = Boolean(promised && promised < today);
        const dueSoon = Boolean(
          promised && promised >= today && promised <= addDays(today, 3),
        );
        if (overdue <= 0.005 && !promisedOverdue && !dueSoon) return null;
        return {
          client,
          statement,
          overdue,
          netDue: statement.netDue,
          promised,
          flag: promisedOverdue
            ? ("broken-promise" as const)
            : dueSoon
              ? ("due-soon" as const)
              : ("overdue" as const),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.overdue - a!.overdue) as Array<{
      client: (typeof clients)[0];
      statement: ReturnType<typeof buildArStatement>;
      overdue: number;
      netDue: number;
      promised: string;
      flag: "broken-promise" | "due-soon" | "overdue";
    }>;
  }, [clients, invoices, creditNotes, today]);

  const blast = () => {
    let n = 0;
    for (const row of rows) {
      if (!normalizePhoneE164(row.client.phone)) continue;
      openOverdueWhatsApp(row.client, row.statement);
      n += 1;
    }
    toast.success(n ? `Opened ${n} WhatsApp chat${n === 1 ? "" : "s"}` : "No phones to message");
  };

  return (
    <>
      <PageHeader
        title="Promise pay chase"
        subtitle="Clients with overdue AR or a promised pay date — one-tap WhatsApp"
        actions={
          <Button type="button" className="gap-1.5" onClick={blast} disabled={!rows.length}>
            <MessageCircle className="h-4 w-4" />
            Message all with phone
          </Button>
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>Promised</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="text-right">Net due</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Nobody to chase right now.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.client.id}>
                      <TableCell className="font-medium">{row.client.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.flag === "broken-promise" ? "destructive" : "secondary"
                          }
                        >
                          {row.flag === "broken-promise"
                            ? "Promise broken"
                            : row.flag === "due-soon"
                              ? "Due soon"
                              : "Overdue"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.promised || "—"}</TableCell>
                      <TableCell className="text-right">{currency(row.overdue)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(row.netDue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={!normalizePhoneE164(row.client.phone)}
                          onClick={() => openOverdueWhatsApp(row.client, row.statement)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </Button>
                      </TableCell>
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

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
