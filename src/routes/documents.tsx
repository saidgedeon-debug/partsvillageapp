import { createFileRoute } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { FileText, Receipt, PackageSearch } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  quotations,
  invoices,
  supplierInquiries,
  clientById,
  currency,
} from "@/lib/mock-data";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Parts Village" },
      { name: "description", content: "Generate and manage quotations, invoices, and supplier inquiries." },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { query } = useSearch();
  const q = query.trim().toLowerCase();

  const filteredQuotes = useMemo(
    () =>
      quotations.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          (clientById(x.clientId)?.name.toLowerCase().includes(q) ?? false),
      ),
    [q],
  );
  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          (clientById(x.clientId)?.name.toLowerCase().includes(q) ?? false),
      ),
    [q],
  );
  const filteredInquiries = useMemo(
    () =>
      supplierInquiries.filter(
        (x) =>
          !q ||
          x.id.toLowerCase().includes(q) ||
          x.supplier.toLowerCase().includes(q) ||
          x.partNumbers.some((p) => p.toLowerCase().includes(q)),
      ),
    [q],
  );

  const create = (kind: string) => toast.success(`New ${kind} draft created`);

  return (
    <>
      <PageHeader title="Documents" subtitle="Quotations, invoices, and supplier inquiries" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Tabs defaultValue="quotations">
          <TabsList>
            <TabsTrigger value="quotations"><FileText className="mr-2 h-4 w-4" />Quotations</TabsTrigger>
            <TabsTrigger value="invoices"><Receipt className="mr-2 h-4 w-4" />Invoices</TabsTrigger>
            <TabsTrigger value="inquiries"><PackageSearch className="mr-2 h-4 w-4" />Supplier Inquiries</TabsTrigger>
          </TabsList>

          <TabsContent value="quotations" className="mt-4">
            <DocCard
              title="Quotations"
              onNew={() => create("quotation")}
              headers={["#", "Client", "Date", "Total", "Status"]}
              rows={filteredQuotes.map((qu) => [
                <span key="i" className="font-mono text-xs">{qu.id}</span>,
                clientById(qu.clientId)?.name ?? "—",
                qu.date,
                <span key="t" className="font-semibold">{currency(qu.total)}</span>,
                <Badge key="s" variant={qu.status === "Accepted" ? "default" : qu.status === "Rejected" ? "destructive" : "secondary"}>{qu.status}</Badge>,
              ])}
              empty={q ? `No quotations match “${query}”.` : "No quotations yet."}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <DocCard
              title="Invoices"
              onNew={() => create("invoice")}
              headers={["#", "Client", "Date", "Total", "Status"]}
              rows={filteredInvoices.map((iv) => [
                <span key="i" className="font-mono text-xs">{iv.id}</span>,
                clientById(iv.clientId)?.name ?? "—",
                iv.date,
                <span key="t" className="font-semibold">{currency(iv.total)}</span>,
                <Badge key="s" variant={iv.status === "Paid" ? "default" : iv.status === "Overdue" ? "destructive" : "secondary"}>{iv.status}</Badge>,
              ])}
              empty={q ? `No invoices match “${query}”.` : "No invoices yet."}
            />
          </TabsContent>

          <TabsContent value="inquiries" className="mt-4">
            <DocCard
              title="Supplier Inquiries"
              onNew={() => create("supplier inquiry")}
              headers={["#", "Supplier", "Date", "Part Numbers", "Status"]}
              rows={filteredInquiries.map((s) => [
                <span key="i" className="font-mono text-xs">{s.id}</span>,
                s.supplier,
                s.date,
                <span key="p" className="font-mono text-xs text-muted-foreground">{s.partNumbers.join(", ")}</span>,
                <Badge key="st" variant={s.status === "Answered" ? "default" : s.status === "Closed" ? "outline" : "secondary"}>{s.status}</Badge>,
              ])}
              empty={q ? `No inquiries match “${query}”.` : "No inquiries yet."}
            />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function DocCard({
  title, onNew, headers, rows, empty,
}: {
  title: string;
  onNew: () => void;
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" onClick={onNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
          + New {title.slice(0, -1)}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-12 text-center text-sm text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}