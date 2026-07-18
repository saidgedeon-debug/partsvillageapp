import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Pencil, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useParties } from "@/components/app/parties-context";
import { PartyFormDialog } from "@/components/app/party-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/suppliers/$supplierId")({
  head: () => ({
    meta: [
      { title: "Supplier — Parts Village" },
      { name: "description", content: "Supplier contact details for purchasing and inquiries." },
    ],
  }),
  component: SupplierDetail,
});

function SupplierDetail() {
  const { supplierId } = Route.useParams();
  const navigate = useNavigate();
  const { getSupplier, removeSupplier } = useParties();
  const [editOpen, setEditOpen] = useState(false);
  const supplier = getSupplier(supplierId);

  if (!supplier) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Supplier not found.</p>
        <Link to="/suppliers" className="text-accent hover:underline">
          Back to suppliers
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={supplier.name} subtitle={supplier.contactName || "Saved supplier"} />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/suppliers">
              <ArrowLeft className="mr-1 h-4 w-4" /> All suppliers
            </Link>
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit details
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive"
            onClick={() => {
              if (!window.confirm(`Delete supplier “${supplier.name}”?`)) return;
              removeSupplier(supplier.id);
              toast.success("Supplier deleted");
              void navigate({ to: "/suppliers" });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" />
              {supplier.email || "—"}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-accent" />
              {supplier.phone || "—"}
            </p>
            <p className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="h-4 w-4 text-accent" />
              {supplier.address || "—"}
            </p>
            {supplier.notes && (
              <p className="flex items-start gap-2 sm:col-span-2">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {supplier.notes}
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <PartyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        kind="supplier"
        party={supplier}
      />
    </>
  );
}
