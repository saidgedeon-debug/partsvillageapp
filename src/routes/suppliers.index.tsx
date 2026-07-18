import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, ChevronRight, Plus } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { useSearch } from "@/components/app/search-context";
import { useParties } from "@/components/app/parties-context";
import { PartyFormDialog } from "@/components/app/party-form-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/suppliers/")({
  head: () => ({
    meta: [
      { title: "Suppliers CRM — Parts Village" },
      { name: "description", content: "Supplier directory for inquiries and purchasing." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { query } = useSearch();
  const { suppliers } = useParties();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contactName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q),
    );
  }, [q, suppliers]);

  return (
    <>
      <PageHeader
        title="Suppliers CRM"
        subtitle={`${rows.length} of ${suppliers.length} suppliers`}
      />
      <main className="flex-1 space-y-3 p-4 md:p-6">
        <div className="flex justify-end">
          <Button type="button" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add supplier
          </Button>
        </div>

        {rows.map((s) => (
          <Link
            key={s.id}
            to="/suppliers/$supplierId"
            params={{ supplierId: s.id }}
            className="block"
          >
            <Card className="transition hover:border-accent/60 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">{s.name}</h3>
                  <p className="truncate text-sm text-muted-foreground">
                    {[s.contactName, s.email, s.phone].filter(Boolean).join(" · ") ||
                      "No contact yet — open to add details"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}

        {rows.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {suppliers.length === 0 ? (
              <div className="space-y-3">
                <p>No suppliers yet.</p>
                <Button type="button" onClick={() => setAddOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add first supplier
                </Button>
              </div>
            ) : (
              `No suppliers match “${query}”.`
            )}
          </div>
        )}
      </main>

      <PartyFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        kind="supplier"
        onSaved={(p) => navigate({ to: "/suppliers/$supplierId", params: { supplierId: p.id } })}
      />
    </>
  );
}
