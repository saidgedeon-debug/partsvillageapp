import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardList, MoreHorizontal, Plus, Ship, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PreOrderFormDialog } from "@/components/app/preorder-form-dialog";
import { usePreOrders } from "@/components/app/preorders-context";
import { useShipments, type ShipmentLine } from "@/components/app/shipments-context";
import { SupplierOrderListDialog } from "@/components/app/supplier-order-list-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { localTodayIso } from "@/lib/date-local";
import { currency } from "@/lib/mock-data";
import {
  preOrderIsPaid,
  preOrderRemaining,
  type CustomerPreOrder,
} from "@/lib/preorders";
import { statusChipClass } from "@/lib/status-styles";
import { useAppRole } from "@/hooks/use-app-role";

export const Route = createFileRoute("/pre-orders")({
  head: () => ({
    meta: [
      { title: "Customer pre-orders — Parts Village" },
      {
        name: "description",
        content: "Track customer deposits and build anonymous supplier order lists.",
      },
    ],
  }),
  component: PreOrdersPage,
});

function PreOrdersPage() {
  const navigate = useNavigate();
  const { orders, recordDeposit, removeOrder, updateOrder } = usePreOrders();
  const { addShipment } = useShipments();
  const { canSeePayments } = useAppRole();
  const [formOpen, setFormOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerPreOrder | null>(null);
  const [depositOrder, setDepositOrder] = useState<CustomerPreOrder | null>(null);
  const [depositAmount, setDepositAmount] = useState("");

  const rows = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          b.orderedAt.localeCompare(a.orderedAt) || b.createdAt.localeCompare(a.createdAt),
      ),
    [orders],
  );

  const pendingBalance = rows.filter((order) => !preOrderIsPaid(order)).length;
  const openProcurement = rows.filter((order) => order.needsProcurement).length;

  const createShipmentFromOrder = (order: CustomerPreOrder) => {
    const lines: ShipmentLine[] = order.lines.map((line, index) => ({
      id: `sl-${order.id}-${index}`,
      partId: line.partId || undefined,
      partNumber: line.partNumber,
      name: line.name,
      qtyOrdered: Math.max(0, Math.round(line.qty) || 0),
      qtyReceived: 0,
    }));
    const ship = addShipment({
      title: `Pre-order · ${order.clientName}`,
      orderedAt: localTodayIso(),
      status: "Ordered",
      category: "other",
      cargoType: "divers",
      notes: `From customer pre-order ${order.id}${order.notes ? `\n${order.notes}` : ""}`,
      lines,
      preOrderId: order.id,
    });
    updateOrder(order.id, { needsProcurement: false });
    toast.success("China shipment draft created");
    void navigate({ to: "/china-shipments", search: { open: ship.id } });
  };

  return (
    <>
      <PageHeader
        title="Customer pre-orders"
        subtitle={`${rows.length} orders · ${pendingBalance} with balance due · ${openProcurement} need abroad procurement`}
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New pre-order
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => setSupplierOpen(true)}
          >
            <ClipboardList className="h-4 w-4" />
            Generate Supplier Order List
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order & payment tracking</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Part(s) ordered</TableHead>
                  <TableHead>Order date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid (deposit)</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={ClipboardList}
                        title="No customer pre-orders yet"
                        description="Create one to track deposits for abroad parts."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((order) => {
                    const remaining = preOrderRemaining(order);
                    const paid = preOrderIsPaid(order);
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-medium">{order.clientName}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {order.needsProcurement ? (
                              <Badge variant="secondary" className="text-xs">
                                Abroad pending
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Ordered / closed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {order.lines.map((line) => (
                            <div key={`${order.id}-${line.partId}-${line.partNumber}`} className="text-sm">
                              <span className="font-mono text-xs font-semibold">{line.partNumber}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                — {line.name} ×{line.qty}
                              </span>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>{order.orderedAt}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(order.total)}
                        </TableCell>
                        <TableCell className="text-right">{currency(order.amountPaid)}</TableCell>
                        <TableCell className="text-right">
                          <span className={statusChipClass(paid ? "success" : "warning")}>
                            {currency(remaining)}
                          </span>
                          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                            {paid ? "Fully paid" : "Pending balance"}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {canSeePayments ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDepositOrder(order);
                                  setDepositAmount(String(remaining > 0 ? remaining : ""));
                                }}
                              >
                                Deposit
                              </Button>
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  aria-label="More actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => createShipmentFromOrder(order)}>
                                  <Ship className="h-3.5 w-3.5" />
                                  Create China shipment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing(order);
                                    setFormOpen(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                {order.needsProcurement ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      updateOrder(order.id, { needsProcurement: false });
                                      toast.success("Marked as ordered from supplier");
                                    }}
                                  >
                                    Mark ordered
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (!confirm(`Delete pre-order for ${order.clientName}?`)) return;
                                    removeOrder(order.id);
                                    toast.message("Pre-order deleted");
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <PreOrderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        order={editing}
      />
      <SupplierOrderListDialog open={supplierOpen} onOpenChange={setSupplierOpen} />

      <Dialog
        open={Boolean(depositOrder)}
        onOpenChange={(open) => {
          if (!open) setDepositOrder(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {depositOrder?.clientName} · remaining{" "}
              {depositOrder ? currency(preOrderRemaining(depositOrder)) : "—"}
            </p>
            <Label htmlFor="deposit-amount">Amount</Label>
            <Input
              id="deposit-amount"
              type="number"
              min={0}
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDepositOrder(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!depositOrder) return;
                const amount = Number(depositAmount);
                if (!Number.isFinite(amount) || amount <= 0) {
                  toast.error("Enter a valid deposit amount");
                  return;
                }
                const updated = recordDeposit(depositOrder.id, amount);
                if (!updated) {
                  toast.error("Could not record deposit");
                  return;
                }
                toast.success(`Deposit recorded · remaining ${currency(preOrderRemaining(updated))}`);
                setDepositOrder(null);
              }}
            >
              Save deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
