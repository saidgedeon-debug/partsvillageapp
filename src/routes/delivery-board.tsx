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
import {
  FULFILLMENT_STATUSES,
  deriveDocFulfillment,
  effectiveFulfillment,
  fulfillmentIsMixed,
  type FulfillmentStatus,
} from "@/lib/fulfillment";
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
  return effectiveFulfillment(doc) ?? "Waiting parts";
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

  const setDocStatus = (iv: SavedDocument, next: FulfillmentStatus) => {
    updateDocument({
      ...iv,
      fulfillmentStatus: next,
      lines: (iv.lines ?? []).map((l) => ({ ...l, fulfillmentStatus: next })),
    });
    toast.success(`${iv.id} → ${next} (all lines)`);
  };

  const setLineStatus = (
    iv: SavedDocument,
    partId: string,
    next: FulfillmentStatus | undefined,
  ) => {
    const lines = (iv.lines ?? []).map((l) =>
      l.partId === partId ? { ...l, fulfillmentStatus: next } : l,
    );
    const derived = deriveDocFulfillment(lines);
    updateDocument({
      ...iv,
      lines,
      fulfillmentStatus: derived ?? iv.fulfillmentStatus,
    });
    toast.success(
      next
        ? `${iv.id} · line → ${next}`
        : `${iv.id} · line status cleared`,
    );
  };

  return (
    <>
      <PageHeader
        title="Delivery / pickup board"
        subtitle="Mark some lines Ready and others Waiting on the same invoice — or advance the whole order"
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
                      const mixed = fulfillmentIsMixed(iv.lines ?? []);
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
                                {mixed ? " · Mixed lines" : ""}
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
                            onValueChange={(v) => setDocStatus(iv, v as FulfillmentStatus)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FULFILLMENT_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  All lines · {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(iv.lines ?? []).length > 0 ? (
                            <div className="space-y-1.5 rounded-md border border-dashed border-border p-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Partial pickup
                              </p>
                              {(iv.lines ?? []).slice(0, 12).map((line) => (
                                <div
                                  key={`${iv.id}-${line.partId}`}
                                  className="flex items-center gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-mono text-[11px] font-semibold">
                                      {line.partNumber}
                                    </p>
                                    <p className="truncate text-[10px] text-muted-foreground">
                                      ×{line.qty} {line.name}
                                    </p>
                                  </div>
                                  <Select
                                    value={line.fulfillmentStatus ?? "__inherit__"}
                                    onValueChange={(v) =>
                                      setLineStatus(
                                        iv,
                                        line.partId,
                                        v === "__inherit__"
                                          ? undefined
                                          : (v as FulfillmentStatus),
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-[7.5rem] shrink-0 text-[11px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__inherit__">—</SelectItem>
                                      {FULFILLMENT_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                          {s}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                              {(iv.lines ?? []).length > 12 ? (
                                <p className="text-[10px] text-muted-foreground">
                                  +{(iv.lines ?? []).length - 12} more — edit invoice for all
                                </p>
                              ) : null}
                            </div>
                          ) : null}
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
                                    `Hi ${iv.partyName}, your order ${iv.id} is ${statusOf(iv)}${
                                      mixed ? " (some lines still waiting)" : ""
                                    }.`,
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Phone className="mr-1 h-3.5 w-3.5" />
                                  WhatsApp
                                </a>
                              </Button>
                            ) : null}
                            <Button type="button" size="sm" variant="ghost" asChild>
                              <Link to="/documents">Documents</Link>
                            </Button>
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
          Tip: set individual lines to Ready / Waiting parts for partial pickup, or use “All lines”
          to advance the whole invoice.
        </p>
      </main>
    </>
  );
}
