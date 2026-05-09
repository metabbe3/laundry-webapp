"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, PAYMENT_METHOD_LABELS, CUSTOMER_STATUS_CONFIG } from "@/lib/constants";
import type { CustomerStatus } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, ShoppingCart, DollarSign, AlertCircle, TrendingUp, Calendar, Clock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  createdAt: string;
  orderItems: { id: string }[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    notes: string | null;
    createdAt: string;
  }[];
}

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  totalPaid: number;
  outstandingBalance: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
  avgDaysBetweenOrders: number | null;
  customerStatus: CustomerStatus;
  serviceBreakdown: {
    serviceId: string;
    name: string;
    orderCount: number;
    totalRevenue: number;
  }[];
  paymentMethodBreakdown: {
    method: string;
    count: number;
    total: number;
  }[];
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  orders: Order[];
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { isEmployee, isLoading: roleLoading } = useRole();
  const { t } = useTranslation();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!roleLoading && isEmployee) router.replace("/customers");
  }, [isEmployee, roleLoading, router]);

  // Resolve customer ID from params
  useEffect(() => {
    params.then(({ id }) => setCustomerId(id));
  }, [params]);

  // Fetch customer + orders
  useEffect(() => {
    if (!customerId) return;
    const q = new URLSearchParams();
    if (dateFrom) q.set("from", dateFrom);
    if (dateTo) q.set("to", dateTo);
    fetch(`/api/customers/${customerId}?${q.toString()}`)
      .then((r) => r.json())
      .then(setCustomer)
      .catch(() => toast.error(t("customerDetails.failedLoad")))
      .finally(() => setLoading(false));
  }, [customerId, dateFrom, dateTo]);

  // Fetch stats
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const q = new URLSearchParams();
    if (dateFrom) q.set("from", dateFrom);
    if (dateTo) q.set("to", dateTo);
    fetch(`/api/customers/${customerId}/stats?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [customerId, dateFrom, dateTo]);

  // Refresh handler
  function refresh() {
    if (!customerId) return;
    setSpinning(true);
    const q = new URLSearchParams();
    if (dateFrom) q.set("from", dateFrom);
    if (dateTo) q.set("to", dateTo);
    Promise.all([
      fetch(`/api/customers/${customerId}?${q.toString()}`).then((r) => r.json()),
      fetch(`/api/customers/${customerId}/stats?${q.toString()}`).then((r) => r.json()),
    ])
      .then(([c, s]) => { setCustomer(c); setStats(s); })
      .catch(() => toast.error(t("common.failedLoad")))
      .finally(() => setSpinning(false));
  }

  if (roleLoading || isEmployee) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!customer) {
    return <p className="text-center py-12 text-muted-foreground">{t("customers.notFound")}</p>;
  }

  // Flatten payments across all orders for payment history
  const allPayments = customer.orders.flatMap((o) =>
    o.payments.map((p) => ({ ...p, orderNumber: o.orderNumber, orderId: o.id }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/customers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
              {stats && (
                <Badge className={CUSTOMER_STATUS_CONFIG[stats.customerStatus].color}>
                  {t(CUSTOMER_STATUS_CONFIG[stats.customerStatus].labelKey)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t("customerDetails.detailsAndAnalytics")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={spinning}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${spinning ? "animate-spin" : ""}`} />
          {t("customerDetails.refresh")}
        </Button>
      </div>

      {/* Customer Info Card with warm accent */}
      <Card className="border-0 shadow-none bg-gradient-to-br from-white/90 to-[oklch(0.97_0.02_85/0.8)] dark:from-[oklch(0.195_0.025_55/0.6)] dark:to-[oklch(0.195_0.030_55/0.5)] rounded-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)]" />
        <CardHeader><CardTitle className="text-base">{t("customerDetails.information")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: t("common.name"), value: customer.name },
              { label: t("common.phone"), value: customer.phone },
              { label: t("common.email"), value: customer.email },
              { label: t("customerDetails.memberSince"), value: formatDate(customer.createdAt) },
            ].map((field) => (
              <div key={field.label} className="space-y-1 min-h-[3.5rem]">
                <p className="text-sm text-muted-foreground">{field.label}</p>
                <p className={`font-medium ${!field.value ? "text-muted-foreground italic" : ""}`}>
                  {field.value || t("common.notProvided")}
                </p>
              </div>
            ))}
          </div>
          {customer.notes && (
            <>
              <Separator className="my-4" />
              <div className="space-y-1 min-h-[3.5rem]">
                <p className="text-sm text-muted-foreground">{t("common.notes")}</p>
                <p className="text-sm">{customer.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Date Filter Row */}
      <div className="flex items-center gap-3 flex-wrap bg-muted/30 border border-border/60 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-muted-foreground">{t("common.from")}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-[150px]" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-muted-foreground">{t("common.to")}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-[150px]" />
        </div>
        {hasDateFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            {t("customerDetails.reset")}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[oklch(0.72_0.17_75)]" />
                <p className="text-sm text-muted-foreground">{t("common.orders")}</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.totalOrders}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-muted-foreground">{t("customerDetails.totalSpent")}</p>
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalSpent)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className={`h-4 w-4 ${stats.outstandingBalance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`} />
                <p className="text-sm text-muted-foreground">{t("customerDetails.outstanding")}</p>
              </div>
              <p className={`text-2xl font-bold mt-1 ${stats.outstandingBalance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {formatCurrency(stats.outstandingBalance)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[oklch(0.68_0.12_40)]" />
                <p className="text-sm text-muted-foreground">{t("customerDetails.avgOrder")}</p>
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.avgOrderValue)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[oklch(0.72_0.17_75)]" />
                <p className="text-sm text-muted-foreground">{t("customerDetails.lastVisit")}</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {stats.daysSinceLastOrder !== null ? t("customerDetails.daysAgo").replace("{days}", String(stats.daysSinceLastOrder)) : "-"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[oklch(0.55_0.18_30)]" />
                <p className="text-sm text-muted-foreground">{t("customerDetails.avgBetween")}</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {stats.avgDaysBetweenOrders !== null ? t("customerDetails.days").replace("{days}", String(stats.avgDaysBetweenOrders)) : "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t("common.orders")}</TabsTrigger>
          <TabsTrigger value="services">{t("customerDetails.services")}</TabsTrigger>
          <TabsTrigger value="payments">{t("common.payment")}</TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardHeader><CardTitle className="text-base">{t("customerDetails.orderHistory")}</CardTitle></CardHeader>
            <CardContent>
              {customer.orders.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {hasDateFilter ? t("customerDetails.noOrdersPeriod") : t("customerDetails.noOrders")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="py-2 text-left font-medium">{t("customerDetails.orderNumber")}</th>
                        <th className="py-2 text-left font-medium">{t("common.date")}</th>
                        <th className="py-2 text-right font-medium">{t("common.items")}</th>
                        <th className="py-2 text-right font-medium">{t("common.total")}</th>
                        <th className="py-2 text-center font-medium">{t("common.status")}</th>
                        <th className="py-2 text-center font-medium">{t("common.payment")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders.map((order) => (
                        <tr key={order.id} className="border-b last:border-0 border-border/40 hover:bg-muted/30">
                          <td className="py-2.5">
                            <Link href={`/orders/${order.id}`} className="font-medium text-[oklch(0.72_0.17_75)] hover:underline">
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="py-2.5 text-muted-foreground">{formatDate(order.createdAt)}</td>
                          <td className="py-2.5 text-right">{order.orderItems?.length ?? "-"}</td>
                          <td className="py-2.5 text-right font-medium">{formatCurrency(order.totalAmount)}</td>
                          <td className="py-2.5 text-center">
                            <Badge className={ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.color}>
                              {t(ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.labelKey ?? order.status)}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-center">
                            <Badge className={PAYMENT_STATUS_CONFIG[order.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG]?.color}>
                              {t(PAYMENT_STATUS_CONFIG[order.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG]?.labelKey ?? order.paymentStatus)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardHeader><CardTitle className="text-base">{t("customerDetails.servicePreferences")}</CardTitle></CardHeader>
            <CardContent>
              {!stats || stats.serviceBreakdown.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {hasDateFilter ? t("customerDetails.noServiceDataPeriod") : t("customerDetails.noServiceData")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="py-2 text-left font-medium">{t("common.service")}</th>
                        <th className="py-2 text-right font-medium">{t("customerDetails.timesOrdered")}</th>
                        <th className="py-2 text-right font-medium">{t("customerDetails.totalRevenue")}</th>
                        <th className="py-2 text-right font-medium">{t("customerDetails.percentOfTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.serviceBreakdown.map((s) => (
                        <tr key={s.serviceId} className="border-b last:border-0 border-border/40">
                          <td className="py-2.5 font-medium">{s.name}</td>
                          <td className="py-2.5 text-right">{s.orderCount}</td>
                          <td className="py-2.5 text-right">{formatCurrency(s.totalRevenue)}</td>
                          <td className="py-2.5 text-right text-muted-foreground">
                            {stats.totalSpent > 0 ? `${((s.totalRevenue / stats.totalSpent) * 100).toFixed(1)}%` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <div className="space-y-4">
            {/* Payment Method Summary */}
            {stats && stats.paymentMethodBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {stats.paymentMethodBreakdown.map((pm) => (
                  <div key={pm.method} className="flex items-center gap-3 rounded-xl bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] border border-border/40 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {t(PAYMENT_METHOD_LABELS[pm.method as keyof typeof PAYMENT_METHOD_LABELS] ?? pm.method)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("customerDetails.paymentCount").replace("{count}", String(pm.count))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(pm.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payment History */}
            <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
              <CardHeader><CardTitle className="text-base">{t("customerDetails.paymentHistory")}</CardTitle></CardHeader>
              <CardContent>
                {allPayments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    {hasDateFilter ? t("customerDetails.noPaymentsPeriod") : t("customerDetails.noPayments")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="py-2 text-left font-medium">{t("common.date")}</th>
                          <th className="py-2 text-left font-medium">{t("receipt.order")}</th>
                          <th className="py-2 text-left font-medium">{t("customerDetails.method")}</th>
                          <th className="py-2 text-right font-medium">{t("common.amount")}</th>
                          <th className="py-2 text-left font-medium">{t("common.notes")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allPayments.map((p) => (
                          <tr key={p.id} className="border-b last:border-0 border-border/40">
                            <td className="py-2.5 text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                            <td className="py-2.5">
                              <Link href={`/orders/${p.orderId}`} className="font-medium text-[oklch(0.72_0.17_75)] hover:underline">
                                {p.orderNumber}
                              </Link>
                            </td>
                            <td className="py-2.5">{t(PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? p.paymentMethod)}</td>
                            <td className="py-2.5 text-right font-medium">{formatCurrency(p.amount)}</td>
                            <td className="py-2.5 text-muted-foreground">{p.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
