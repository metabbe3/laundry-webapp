"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Clock, CheckCircle, DollarSign, TrendingUp, TrendingDown, RefreshCw, Users, Sparkles, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PageLoading } from "@/components/shared/loading";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { ORDER_STATUS_CONFIG, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { PaymentMethod } from "@/app/generated/prisma/enums";

interface HeatmapData {
  hourlyByDay: number[][];
  revenueByDay: Record<string, number>;
  customerVisits: {
    customerId: string;
    name: string;
    totalOrders: number;
    dayDistribution: number[];
  }[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface TopCustomer {
  customerId: string;
  name: string;
  orders: number;
  totalSpent: number;
}

interface ServiceBreakdown {
  serviceId: string;
  name: string;
  orders: number;
  revenue: number;
}

interface PaymentMethodBreakdown {
  method: PaymentMethod;
  count: number;
  total: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface Stats {
  todayOrders: number;
  inProgress: number;
  readyForPickup: number;
  todayRevenue: number;
  previousRevenue: number;
  revenueChange: number | null;
  topCustomers: TopCustomer[];
  serviceBreakdown: ServiceBreakdown[];
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  recentOrders: RecentOrder[];
}

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("dashboard.goodMorning");
  if (hour < 17) return t("dashboard.goodAfternoon");
  return t("dashboard.goodEvening");
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const router = useRouter();
  const { isEmployee } = useRole();
  const { data: session } = useSession();
  const { t } = useTranslation();

  useEffect(() => {
    if (isEmployee) router.replace("/orders");
  }, [isEmployee, router]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/stats?from=${dateFrom}&to=${dateTo}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => toast.error(t("dashboard.failedLoadStats")));
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, t]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/heatmap?from=${dateFrom}&to=${dateTo}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setHeatmap(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const refresh = useCallback(() => {
    setSpinning(true);
    fetch(`/api/dashboard/stats?from=${dateFrom}&to=${dateTo}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => toast.error(t("dashboard.failedLoadStats")))
      .finally(() => setSpinning(false));
  }, [dateFrom, dateTo, t]);

  if (isEmployee) return null;
  if (!stats) return <PageLoading />;

  const revenueChangeBadge = stats.revenueChange != null ? (
    <Badge variant={stats.revenueChange >= 0 ? "secondary" : "destructive"} className="gap-1 text-[11px]">
      {stats.revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {stats.revenueChange >= 0 ? "+" : ""}{stats.revenueChange.toFixed(1)}%
    </Badge>
  ) : null;

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "there";

  return (
    <div className="space-y-6">
      {/* Header with date filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {getGreeting(t)}, {userName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="date-from" className="whitespace-nowrap text-muted-foreground text-xs">{t("common.from")}</Label>
            <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-[140px] h-9 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-to" className="whitespace-nowrap text-muted-foreground text-xs">{t("common.to")}</Label>
            <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-[140px] h-9 text-sm" />
          </div>
          <Button variant="outline" size="icon" onClick={refresh} title={t("dashboard.refresh")} className="h-9 w-9 shrink-0">
            <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <StatCard
            title={t("common.orders")}
            value={stats.todayOrders}
            icon={ShoppingCart}
            iconColor="text-blue-600"
            iconBg="bg-blue-50 dark:bg-blue-950/50"
          />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <StatCard
            title={t("dashboard.inProgress")}
            value={stats.inProgress}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-950/50"
          />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <StatCard
            title={t("dashboard.readyForPickup")}
            value={stats.readyForPickup}
            icon={CheckCircle}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <StatCard
            title={t("common.revenue")}
            value={formatCurrency(stats.todayRevenue)}
            icon={DollarSign}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50 dark:bg-emerald-950/50"
            extra={revenueChangeBadge}
          />
        </div>
      </div>

      {/* Middle Row: Top Customers + Service Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Customers */}
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-bold">{t("dashboard.topCustomers")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {stats.topCustomers.length === 0 ? (
              <EmptyState title={t("dashboard.noOrders")} description={t("dashboard.noOrdersDesc")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead className="text-right">{t("common.orders")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.totalSpent")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topCustomers.map((customer, i) => (
                    <TableRow key={customer.customerId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-right">{customer.orders}</TableCell>
                      <TableCell className="text-right">{formatCurrency(customer.totalSpent)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Service Breakdown */}
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-bold">{t("dashboard.serviceBreakdown")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {stats.serviceBreakdown.length === 0 ? (
              <EmptyState title={t("dashboard.noServiceData")} description={t("dashboard.noServiceDataDesc")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.service")}</TableHead>
                    <TableHead className="text-right">{t("common.orders")}</TableHead>
                    <TableHead className="text-right">{t("common.revenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.serviceBreakdown.map((service) => {
                    const maxRevenue = Math.max(...stats.serviceBreakdown.map((s) => s.revenue), 1);
                    const pct = (service.revenue / maxRevenue) * 100;
                    return (
                      <TableRow key={service.serviceId}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{service.name}</span>
                            <div className="h-1.5 w-full max-w-[120px] rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{service.orders}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(service.revenue)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      {stats.paymentMethodBreakdown.length > 0 && (
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-bold">{t("dashboard.paymentMethods")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {stats.paymentMethodBreakdown.map((pm) => {
                const totalAll = stats.paymentMethodBreakdown.reduce((s, p) => s + p.total, 0);
                const pct = totalAll > 0 ? (pm.total / totalAll) * 100 : 0;
                return (
                  <div key={pm.method} className="rounded-xl border border-border/40 bg-white/60 dark:bg-[oklch(0.195_0.025_55/0.4)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{t(PAYMENT_METHOD_LABELS[pm.method] ?? pm.method)}</p>
                      <Badge variant="secondary" className="text-[10px]">{pm.count} {pm.count !== 1 ? t("dashboard.payments") : t("dashboard.payment")}</Badge>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(pm.total)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmaps */}
      {heatmap && (
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)]">
          <CardHeader><CardTitle className="text-base font-bold">{t("dashboard.activityHeatmaps")}</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="busy-hours">
              <TabsList className="mb-4">
                <TabsTrigger value="busy-hours">{t("dashboard.busyHours")}</TabsTrigger>
                <TabsTrigger value="revenue">{t("common.revenue")}</TabsTrigger>
                <TabsTrigger value="customers">{t("dashboard.customers")}</TabsTrigger>
              </TabsList>

              {/* Busy Hours Heatmap */}
              <TabsContent value="busy-hours">
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="flex items-center gap-1 mb-1 ml-12">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="w-6 text-center text-[10px] text-muted-foreground">
                          {h % 3 === 0 ? `${h}` : ""}
                        </div>
                      ))}
                    </div>
                    {DAY_LABELS.map((day, dow) => {
                      const maxVal = Math.max(...heatmap.hourlyByDay[dow], 1);
                      return (
                        <div key={day} className="flex items-center gap-1 mb-1">
                          <span className="w-10 text-xs text-muted-foreground text-right pr-1">{day}</span>
                          {heatmap.hourlyByDay[dow].map((count, hour) => {
                            const intensity = count / maxVal;
                            return (
                              <div
                                key={hour}
                                className="w-6 h-6 rounded-[3px] flex items-center justify-center text-[9px] font-medium"
                                style={{
                                  backgroundColor: count === 0
                                    ? "oklch(0.95 0.01 75)"
                                    : `oklch(${0.45 + intensity * 0.15} ${0.05 + intensity * 0.12} 75)`,
                                  color: intensity > 0.5 ? "white" : "inherit",
                                }}
                                title={`${day} ${hour}:00 — ${count} orders`}
                              >
                                {count > 0 ? count : ""}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground mt-2">{t("dashboard.heatmapHint")}</p>
                  </div>
                </div>
              </TabsContent>

              {/* Revenue Heatmap */}
              <TabsContent value="revenue">
                {Object.keys(heatmap.revenueByDay).length === 0 ? (
                  <EmptyState title={t("dashboard.noRevenueData")} description={t("dashboard.noRevenueDataDesc")} />
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(heatmap.revenueByDay)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([day, amount]) => {
                        const maxRevenue = Math.max(...Object.values(heatmap.revenueByDay), 1);
                        const width = (amount / maxRevenue) * 100;
                        return (
                          <div key={day} className="flex items-center gap-2">
                            <span className="w-20 text-xs text-muted-foreground">{new Date(day).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                            <div className="flex-1 h-5 bg-muted rounded-[3px] overflow-hidden">
                              <div
                                className="h-full rounded-[3px] flex items-center px-1.5 text-[10px] font-medium text-white min-w-fit"
                                style={{
                                  width: `${Math.max(width, 2)}%`,
                                  backgroundColor: `oklch(${0.50 + (width / 100) * 0.12} ${0.10 + (width / 100) * 0.10} 75)`,
                                }}
                              >
                                {formatCurrency(amount)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </TabsContent>

              {/* Customer Visits Heatmap */}
              <TabsContent value="customers">
                {heatmap.customerVisits.length === 0 ? (
                  <EmptyState title={t("dashboard.noCustomerData")} description={t("dashboard.noCustomerDataDesc")} />
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[400px]">
                      <div className="flex items-center gap-1 mb-1 ml-32">
                        {DAY_LABELS.map((d) => (
                          <div key={d} className="w-10 text-center text-[10px] text-muted-foreground">{d}</div>
                        ))}
                        <div className="w-12 text-center text-[10px] text-muted-foreground">{t("common.total")}</div>
                      </div>
                      {heatmap.customerVisits.map((customer) => {
                        const maxDay = Math.max(...customer.dayDistribution, 1);
                        return (
                          <div key={customer.customerId} className="flex items-center gap-1 mb-1">
                            <span className="w-28 text-xs font-medium truncate" title={customer.name}>{customer.name}</span>
                            {customer.dayDistribution.map((count, dow) => {
                              const intensity = count / maxDay;
                              return (
                                <div
                                  key={dow}
                                  className="w-10 h-6 rounded-[3px] flex items-center justify-center text-[10px] font-medium"
                                  style={{
                                    backgroundColor: count === 0
                                      ? "oklch(0.95 0.01 75)"
                                      : `oklch(${0.45 + intensity * 0.20} ${0.08 + intensity * 0.14} ${50 + intensity * 25})`,
                                    color: intensity > 0.4 ? "white" : "inherit",
                                  }}
                                  title={`${customer.name} — ${DAY_LABELS[dow]}: ${count} orders`}
                                >
                                  {count > 0 ? count : ""}
                                </div>
                              );
                            })}
                            <span className="w-12 text-center text-xs font-semibold text-muted-foreground">{customer.totalOrders}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">{t("dashboard.recentOrders")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentOrders.length === 0 ? (
            <EmptyState
              title={t("dashboard.noOrdersYet")}
              description={t("dashboard.yourOrderHistory")}
              action={{ label: t("dashboard.createOrder"), onClick: () => router.push("/orders/new") }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.orderNumber")}</TableHead>
                  <TableHead>{t("common.customer")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.total")}</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.color ?? "bg-gray-100 text-gray-800"}`}>
                        {t(ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.labelKey ?? order.status.replace(/_/g, " "))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                      {new Date(order.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
