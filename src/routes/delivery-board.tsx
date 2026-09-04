import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageCheck, Phone } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useDocuments, type SavedDocument } from "@/components/app/documents-context";
import { useParties } from "@/components/app/parties-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FULFILLMENT_STATUSES, type FulfillmentStatus } from "@/lib/fulfillment";
import { currency } from "@/lib/mock-data";
import { normalizePhoneE164 } from "@/lib/phone";
import { downloadPackingSlip } from "@/lib/packing-slip";

export const Route = createFileRoute("/delivery-board")({
  head: () => ({
    meta: [
      { title: "Delivery / pickup board — Parts Village" },
      { name: "description", content: "Track invoice fulfillment from waiting parts to picked up." },
    ],
  }),
  component: DeliveryBoardPage,
});

function statusOf(doc: SavedDocument): FulfillmentStatus {
  return doc.fulfillmentStatus ?? "Waiting parts";
}

function DeliveryBoardPage() {
  const { invoices, updateDocument } = useDocuments();
  const { clients } = useParties();

  const openInvoices = useMemo(
    () =>
      [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [invoices],
  );

  const columns = useMemo(() => {
    const map = new Map<FulfillmentStatus, SavedDocument[]>();
    for (const s of FULFILLMENT_STATUSES) map.set(s, []);
    for (const iv of openInvoices) {
      const s = statusOf(iv);
      map.get(s)!.push(iv);
    }
    return FULFILLMENT_STATUSES.map((status) => ({
      status,
      rows: map.get(status) ?? [],
    }));
  }, [openInvoices]);

  const setStatus = (iv: SavedDocument, next: FulfillmentStatus) => {
    updateDocument({ ...iv, fulfillmentStatus: next });
    toast.success(`${iv.id} → ${next}`);
  };

  return (
    <>
      <PageHeader
        title="Delivery / pickup board"
        subtitle="Advance each invoice from waiting parts → ready → delivered / picked up"
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {openInvoices.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No invoices yet"
            description="Finish a sale on Counter to populate this board."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => (
              <Card key={col.status} className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>{col.status}</span>
                    <Badge variant="secondary">{col.rows.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {col.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Empty</p>
                  ) : (
                    col.rows.slice(0, 40).map((iv) => {
                      const client = clients.find(
                        (c) => c.id === iv.partyId || c.name === iv.partyName,
                      );
                      const phone = normalizePhoneE164(client?.phone ?? "");
                      return (
                        <div
                          key={iv.id}
                          className="space-y-2 rounded-lg border border-border p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold">{iv.id}</p>
                              <p className="truncate text-sm font-medium">{iv.partyName}</p>
                              <p className="text-xs text-muted-foreground">
                                {iv.date} · {currency(iv.total)}
                              </p>
                              {client?.address ? (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {client.address}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Select
                            value={statusOf(iv)}
                            onValueChange={(v) => setStatus(iv, v as FulfillmentStatus)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FULFILLMENT_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                downloadPackingSlip(iv);
                                toast.success("Packing slip downloaded");
                              }}
                            >
                              Packing slip
                            </Button>
                            {phone ? (
                              <Button type="button" size="sm" variant="outline" asChild>
                                <a
                                  href={`https://wa.me/${phone}?text=${encodeURIComponent(
                                    `Hi ${iv.partyName}, your order ${iv.id} is ${statusOf(iv)}.`,
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Phone className="mr-1 h-3.5 w-3.5" />
                                  WhatsApp
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Tip: set fulfillment status at checkout, or change it here / on Documents.
          <Link to="/documents" className="ml-1 text-primary hover:underline">
            Open documents →
          </Link>
        </p>
      </main>
    </>
  );
}
