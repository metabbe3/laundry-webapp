"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ChevronRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, PAYMENT_METHOD_LABELS, PRICING_TYPE_LABELS, ORDER_STATUS_FLOW } from "@/lib/constants";
import { PageLoading } from "@/components/shared/loading";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: "RECEIVED" | "IN_PROGRESS" | "READY" | "DELIVERED";
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  paidAmount: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  notes: string | null;
  createdAt: string;
  receivedAt: string | null;
  inProgressAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  customer: { id: string; name: string; phone: string; email: string | null };
  orderItems: {
    id: string;
    quantity: number;
    weightKg: number | null;
    pricePerUnit: number;
    subtotal: number;
    notes: string | null;
    service: { name: string; pricingType: string };
  }[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    notes: string | null;
    createdAt: string;
  }[];
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { isEmployee } = useRole();
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "CASH" as "CASH" | "DEPOSIT" | "QRIS", notes: "" });

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/orders/${id}`)
        .then((r) => r.json())
        .then(setOrder)
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function updateStatus(newStatus: string) {
    if (!order) return;
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = await res.json();
      setOrder({ ...order, ...updated });
      toast.success(`Status updated to ${t(ORDER_STATUS_CONFIG[newStatus as keyof typeof ORDER_STATUS_CONFIG].labelKey)}`);
    } catch {
      toast.error(t("orders.failedUpdate"));
    }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    try {
      const res = await fetch(`/api/orders/${order.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payForm.amount),
          paymentMethod: payForm.paymentMethod,
          notes: payForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error);
        return;
      }

      toast.success(t("orderDetails.paymentRecorded"));
      setPayDialogOpen(false);
      setPayForm({ amount: "", paymentMethod: "CASH", notes: "" });

      // Reload order
      const updated = await fetch(`/api/orders/${order.id}`).then((r) => r.json());
      setOrder(updated);
    } catch {
      toast.error(t("orderDetails.failedRecord"));
    }
  }

  if (loading) return <PageLoading />;
  if (!order) return <p className="text-center py-12 text-muted-foreground">{t("orderDetails.orderNotFound")}</p>;

  const currentStatusIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentStatusIdx < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[currentStatusIdx + 1] : null;
  const remaining = order.totalAmount - order.paidAmount;

  // Calculate subtotal from items (before discount)
  const itemsSubtotal = order.orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const hasDiscount = order.discountAmount > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {order.status !== "DELIVERED" && nextStatus && (
            <Button onClick={() => updateStatus(nextStatus)} className="bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] shadow-md shadow-[oklch(0.72_0.17_75/0.15)] transition-all hover:shadow-lg hover:brightness-105">
              <ChevronRight className="mr-1 h-4 w-4" />
              {t("orderDetails.markAs").replace("{status}", t(ORDER_STATUS_CONFIG[nextStatus].labelKey))}
            </Button>
          )}
          {!isEmployee && remaining > 0 && (
            <Button variant="outline" onClick={() => setPayDialogOpen(true)}>
              <Banknote className="mr-1 h-4 w-4" />
              {t("orderDetails.recordPayment")}
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
        <CardContent className="pt-6">
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex items-center justify-between min-w-[320px]">
              {ORDER_STATUS_FLOW.map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`flex flex-col items-center ${i <= currentStatusIdx ? "text-[oklch(0.72_0.17_75)]" : "text-muted-foreground"}`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      i <= currentStatusIdx
                        ? "border-[oklch(0.72_0.17_75)] bg-gradient-to-br from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] text-white shadow-md shadow-[oklch(0.72_0.17_75/0.2)]"
                        : "border-muted"
                    }`}>
                      <span className="text-xs font-bold">{i + 1}</span>
                    </div>
                    <span className="mt-1 text-[10px] sm:text-xs font-medium whitespace-nowrap">{t(ORDER_STATUS_CONFIG[s].labelKey)}</span>
                  </div>
                  {i < ORDER_STATUS_FLOW.length - 1 && (
                    <div className={`mx-1 sm:mx-2 h-0.5 w-6 sm:w-12 ${i < currentStatusIdx ? "bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)]" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Info */}
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardHeader><CardTitle className="text-base font-semibold">{t("orderDetails.customer")}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="font-medium">{order.customer.name}</p>
            <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
            {order.customer.email && <p className="text-sm text-muted-foreground">{order.customer.email}</p>}
          </CardContent>
        </Card>

        {/* Payment Summary - hidden for employees */}
        {!isEmployee && (
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardHeader><CardTitle className="text-base font-semibold">{t("orderDetails.payment")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("common.total")}</span>
                <span className="font-semibold">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("orderDetails.paid")}</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(order.paidAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">{t("orderDetails.remaining")}</span>
                <span className={remaining > 0 ? "font-bold text-red-600 dark:text-red-400" : "font-bold text-emerald-600 dark:text-emerald-400"}>
                  {formatCurrency(remaining)}
                </span>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CONFIG[order.paymentStatus].color}`}>
                {t(PAYMENT_STATUS_CONFIG[order.paymentStatus].labelKey)}
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Items */}
      <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
        <CardHeader><CardTitle className="text-base font-semibold">{t("orderDetails.items")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 rounded-lg bg-muted/30 border border-border/40 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.pricePerUnit)} x {item.service.pricingType === "PER_KG" ? `${item.weightKg} ${t("newOrder.kg")}` : `${item.quantity} ${t("orders.items")}`}
                  </p>
                  {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                </div>
                <span className="font-semibold sm:shrink-0">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("orderDetails.subtotal")}</span>
              <span>{formatCurrency(itemsSubtotal)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("orderDetails.discount")}
                  {order.discountType === "PERCENTAGE"
                    ? ` (${Math.round((order.discountAmount / itemsSubtotal) * 100)}%)`
                    : ` ${t("orderDetails.fixed")}`}
                </span>
                <span className="text-red-600 dark:text-red-400">-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-medium">{t("common.total")}</span>
              <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments History - hidden for employees */}
      {!isEmployee && order.payments.length > 0 && (
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardHeader><CardTitle className="text-base font-semibold">{t("orderDetails.paymentHistory")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/40 p-3">
                  <div>
                    <p className="font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS])} &middot; {formatDateTime(p.createdAt)}
                    </p>
                    {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardHeader><CardTitle className="text-base font-semibold">{t("common.notes")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{order.notes}</p></CardContent>
        </Card>
      )}

      {/* Payment Dialog - hidden for employees */}
      {!isEmployee && (
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("orderDetails.recordPayment")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("orderDetails.amount")}</Label>
                <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder={String(remaining)} required />
                <p className="text-xs text-muted-foreground">{t("orderDetails.remaining")}: {formatCurrency(remaining)}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("orderDetails.paymentMethod")}</Label>
                <Select value={payForm.paymentMethod} onValueChange={(v) => v && setPayForm({ ...payForm, paymentMethod: v as "CASH" | "DEPOSIT" | "QRIS" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">{t("paymentMethod.cash")}</SelectItem>
                    <SelectItem value="DEPOSIT">{t("paymentMethod.deposit")}</SelectItem>
                    <SelectItem value="QRIS">{t("paymentMethod.qris")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("common.notes")}</Label>
                <Textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] shadow-md shadow-[oklch(0.72_0.17_75/0.15)] transition-all hover:shadow-lg hover:brightness-105">{t("orderDetails.recordPayment")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
