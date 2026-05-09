"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import {
  Search, ChevronLeft, ChevronRight, Loader2,
  ArrowUpDown, MessageCircle, FileText,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_CONFIG, ORDER_STATUS_FLOW,
  PAYMENT_STATUS_CONFIG,
} from "@/lib/constants";
import { toast } from "sonner";
import Link from "next/link";

interface Order {
  id: string;
  orderNumber: string;
  status: "RECEIVED" | "IN_PROGRESS" | "READY" | "DELIVERED";
  totalAmount: number;
  paidAmount: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  createdAt: string;
  customer: { name: string; phone: string };
  orderItems: { service: { name: string } }[];
}

const STATUS_BORDER: Record<string, string> = {
  RECEIVED: "border-l-sky-500",
  IN_PROGRESS: "border-l-amber-500",
  READY: "border-l-emerald-500",
  DELIVERED: "border-l-slate-400",
};

function getDateRange(from: string, to: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  let dateFrom = "";
  switch (from) {
    case "today":
      dateFrom = fmt(today);
      break;
    case "week":
      dateFrom = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()));
      break;
    case "month":
      dateFrom = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      break;
  }

  const dateTo = to === "today" ? fmt(today) : "";

  return { dateFrom, dateTo };
}

function buildWhatsAppUrl(phone: string, order: Order, t: (key: string) => string) {
  const remaining = order.totalAmount - order.paidAmount;
  const statusLabel = t(ORDER_STATUS_CONFIG[order.status]?.labelKey ?? order.status);
  const items = order.orderItems.map((i) => i.service.name).join(", ");

  const parts = [
    `Halo, ini terkait pesanan *${order.orderNumber}*`,
    `Status: *${statusLabel}*`,
    `Layanan: ${items}`,
    `Total: ${formatCurrency(order.totalAmount)}`,
  ];

  if (remaining > 0) {
    parts.push(`Sisa pembayaran: ${formatCurrency(remaining)}`);
  }

  if (order.status === "READY") {
    parts.push("\nPesanan Anda sudah siap diambil! 🎉");
  }

  const trackingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/track/${order.orderNumber}`;
  parts.push(`\nLacak pesanan: ${trackingUrl}`);

  const message = encodeURIComponent(parts.join("\n"));
  // Clean phone number (remove non-digits, ensure starts with country code)
  const cleanPhone = phone.replace(/\D/g, "");
  const waPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;

  return `https://wa.me/${waPhone}?text=${message}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const { isEmployee } = useRole();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [advancing, setAdvancing] = useState<string | null>(null);

  // Filters
  const [sortValue, setSortValue] = useState("createdAt_desc");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateRangeIdx, setDateRangeIdx] = useState(0);

  const NEXT_ACTION: Record<string, { label: string; status: string }> = {
    RECEIVED: { label: t("orders.start"), status: "IN_PROGRESS" },
    IN_PROGRESS: { label: t("orders.ready"), status: "READY" },
    READY: { label: t("orders.deliver"), status: "DELIVERED" },
  };

  const SORT_OPTIONS = [
    { value: "createdAt_desc", label: t("orders.newestFirst") },
    { value: "createdAt_asc", label: t("orders.oldestFirst") },
    { value: "totalAmount_desc", label: t("orders.totalHighLow") },
    { value: "totalAmount_asc", label: t("orders.totalLowHigh") },
    { value: "customerName_asc", label: t("orders.customerAZ") },
    { value: "customerName_desc", label: t("orders.customerZA") },
  ];

  const DATE_RANGES = [
    { label: t("dateRange.all"), from: "", to: "" },
    { label: t("dateRange.today"), from: "today", to: "today" },
    { label: t("dateRange.thisWeek"), from: "week", to: "today" },
    { label: t("dateRange.thisMonth"), from: "month", to: "today" },
  ];

  const [sortBy, sortOrder] = sortValue.split("_") as [string, string];

  const { dateFrom, dateTo } = getDateRange(
    DATE_RANGES[dateRangeIdx].from,
    DATE_RANGES[dateRangeIdx].to,
  );

  const fetchOrders = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    if (!isEmployee && paymentFilter !== "ALL") params.set("paymentStatus", paymentFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
      })
      .finally(() => setLoading(false));
  }, [status, debouncedSearch, page, sortBy, sortOrder, paymentFilter, dateFrom, dateTo, isEmployee]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch, sortValue, paymentFilter, dateRangeIdx]);

  async function advanceStatus(order: Order, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const action = NEXT_ACTION[order.status];
    if (!action) return;

    setAdvancing(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action.status }),
      });
      if (!res.ok) {
        toast.error(t("orders.failedUpdate"));
        return;
      }
      const updated = await res.json();
      if (status !== "ALL") {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: updated.status } : o))
        );
      }
      toast.success(`${order.orderNumber} → ${t(ORDER_STATUS_CONFIG[action.status as keyof typeof ORDER_STATUS_CONFIG].labelKey)}`);
    } catch {
      toast.error(t("orders.failedUpdate"));
    } finally {
      setAdvancing(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} description={t("orders.description")} action={{ label: t("orders.newOrder"), onClick: () => router.push("/orders/new") }} />

      {/* Status Tabs + Search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="overflow-x-auto -mx-1 px-1">
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList>
                <TabsTrigger value="ALL">{t("orders.all")}</TabsTrigger>
                <TabsTrigger value="RECEIVED">{t("status.received")}</TabsTrigger>
                <TabsTrigger value="IN_PROGRESS">{t("status.inProgress")}</TabsTrigger>
                <TabsTrigger value="READY">{t("status.ready")}</TabsTrigger>
                <TabsTrigger value="DELIVERED">{t("status.delivered")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("orders.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted/30 border-border/60" />
          </div>
        </div>
      </div>

      {/* Filters Row: Sort, Payment, Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort */}
        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-muted/30 px-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Payment Filter - hidden for employees */}
        {!isEmployee && (
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="ALL">{t("orders.allPayments")}</option>
              <option value="PENDING">{t("status.unpaid")}</option>
              <option value="PARTIAL">{t("status.partial")}</option>
              <option value="PAID">{t("status.paid")}</option>
            </select>
          </div>
        )}

        {/* Date Range */}
        <div className="flex gap-1 overflow-x-auto">
          {DATE_RANGES.map((dr, i) => (
            <Button
              key={i}
              variant={dateRangeIdx === i ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRangeIdx(i)}
              className={`text-xs h-8 ${dateRangeIdx === i ? "shadow-sm" : "bg-muted/30 border-border/40 hover:bg-muted/50 hover:border-border/60"}`}
            >
              {dr.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <PageLoading />
      ) : orders.length === 0 ? (
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            {search || status !== "ALL" || (!isEmployee && paymentFilter !== "ALL") || dateRangeIdx !== 0
              ? t("orders.noOrdersFilter")
              : t("orders.noOrders")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order, idx) => {
              const action = NEXT_ACTION[order.status];
              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className={`border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl transition-all hover:shadow-md mb-3 border-l-4 ${STATUS_BORDER[order.status] ?? ""} animate-fade-in-up ${idx < 6 ? `stagger-${idx + 1}` : ""}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{order.orderNumber}</span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${ORDER_STATUS_CONFIG[order.status].color}`}>
                              {t(ORDER_STATUS_CONFIG[order.status].labelKey)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {order.customer.name} &middot; {order.orderItems.length} {t("orders.items")}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                        </div>
                        {/* Desktop: price + actions inline */}
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                            {!isEmployee && (
                              <p className={`text-xs ${order.paymentStatus === "PAID" ? "text-green-600" : order.paymentStatus === "PARTIAL" ? "text-amber-600" : "text-red-600"}`}>
                                {order.paymentStatus === "PAID" ? t("status.paid") : order.paymentStatus === "PARTIAL" ? `${t("status.paid")} ${formatCurrency(order.paidAmount)}` : t("status.unpaid")}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(buildWhatsAppUrl(order.customer.phone, order, t), '_blank'); }}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50/80 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`/orders/${order.id}/receipt`, '_blank'); }}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {action && (
                            <Button
                              size="sm"
                              variant={order.status === "READY" ? "default" : "outline"}
                              onClick={(e) => advanceStatus(order, e)}
                              disabled={advancing === order.id}
                              className="shrink-0 rounded-lg"
                            >
                              {advancing === order.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                              {action.label}
                            </Button>
                          )}
                        </div>
                        {/* Mobile: price only */}
                        <div className="sm:hidden text-right shrink-0">
                          <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                          {!isEmployee && (
                            <p className={`text-xs ${order.paymentStatus === "PAID" ? "text-green-600" : order.paymentStatus === "PARTIAL" ? "text-amber-600" : "text-red-600"}`}>
                              {order.paymentStatus === "PAID" ? t("status.paid") : order.paymentStatus === "PARTIAL" ? `${t("status.paid")} ${formatCurrency(order.paidAmount)}` : t("status.unpaid")}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Mobile: actions row below */}
                      <div className="flex sm:hidden items-center gap-1.5 mt-3 pt-3 border-t border-border/40">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(buildWhatsAppUrl(order.customer.phone, order, t), '_blank'); }}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50/80 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`/orders/${order.id}/receipt`, '_blank'); }}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        {action && (
                          <Button
                            size="sm"
                            variant={order.status === "READY" ? "default" : "outline"}
                            onClick={(e) => advanceStatus(order, e)}
                            disabled={advancing === order.id}
                            className="ml-auto shrink-0 rounded-lg"
                          >
                            {advancing === order.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            {action.label}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("common.prev")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.page").replace("{page}", String(page)).replace("{total}", String(totalPages))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg"
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
