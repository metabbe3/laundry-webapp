"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";

interface RevenueReportProps {
  from: string;
  to: string;
}

interface RevenueSummary {
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  totalPaid: number;
  ordersCount: number;
}

interface PaymentMethodRow {
  method: string;
  count: number;
  total: number;
}

interface DailyTrendRow {
  date: string;
  revenue: number;
  orders: number;
}

interface PaymentStatusRow {
  status: string;
  count: number;
  totalAmount: number;
  paidAmount: number;
}

interface RevenueData {
  summary: RevenueSummary;
  byPaymentMethod: PaymentMethodRow[];
  dailyTrend: DailyTrendRow[];
  byPaymentStatus: PaymentStatusRow[];
}

export function RevenueReport({ from, to }: RevenueReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/reports/revenue?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, byPaymentMethod, dailyTrend, byPaymentStatus } = data;

  // Compute cumulative revenue for daily trend
  const dailyWithCumulative = dailyTrend.map(
    (
      (cumulative) => (row: DailyTrendRow) => ({
        ...row,
        cumulative: (cumulative += row.revenue),
      })
    )(0)
  );

  const totalRevenue = dailyTrend.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = dailyTrend.reduce((sum, d) => sum + d.orders, 0);

  const totalMethodCount = byPaymentMethod.reduce((s, r) => s + r.count, 0);
  const totalMethodAmount = byPaymentMethod.reduce((s, r) => s + r.total, 0);

  // Export data
  const csvHeaders = { date: t("common.date"), revenue: t("common.revenue"), orders: t("common.orders") };
  const csvData = dailyTrend.map((d) => ({
    date: formatDate(d.date),
    revenue: d.revenue,
    orders: d.orders,
  }));
  const baseFilename = `revenue-report-${from}-to-${to}`;

  const summaryCards = [
    {
      title: t("revenue.grossRevenue"),
      value: formatCurrency(summary.grossRevenue),
      icon: DollarSign,
      iconColor: "text-amber-600",
      bgIconColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      title: t("revenue.netRevenue"),
      value: formatCurrency(summary.netRevenue),
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      bgIconColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      title: t("revenue.discounts"),
      value: formatCurrency(summary.totalDiscount),
      icon: DollarSign,
      iconColor: "text-red-600",
      bgIconColor: "bg-red-100 dark:bg-red-900/30",
    },
    {
      title: t("revenue.totalPaid"),
      value: formatCurrency(summary.totalPaid),
      icon: DollarSign,
      iconColor: "text-green-600",
      bgIconColor: "bg-green-100 dark:bg-green-900/30",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-2 ${card.bgIconColor}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <span className="text-sm text-muted-foreground">{card.title}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Toolbar */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCsv(csvData, `${baseFilename}.csv`, csvHeaders)}
        >
          <Download className="size-4" />
          {t("common.exportCsv")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToXls(csvData, `${baseFilename}.xls`, "Revenue", csvHeaders)}
        >
          <FileSpreadsheet className="size-4" />
          {t("common.exportXls")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToPdf("revenue", from, to)}
        >
          <FileText className="size-4" />
          {t("common.exportPdf")}
        </Button>
      </div>

      {/* Daily Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t("revenue.dailyRevenueTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "date", label: t("common.date"), format: (v) => formatDate(v as string) },
              { key: "revenue", label: t("common.revenue"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "orders", label: t("common.orders"), align: "right" },
              { key: "cumulative", label: t("revenue.cumulative"), align: "right", format: (v) => formatCurrency(v as number) },
            ]}
            data={dailyWithCumulative as unknown as Record<string, unknown>[]}
            summaryRow={{
              date: "",
              revenue: totalRevenue,
              orders: totalOrders,
              cumulative: totalRevenue,
            }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Payment Method Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t("revenue.paymentMethodBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              {
                key: "method",
                label: t("reports.method"),
                format: (v) =>
                  t(PAYMENT_METHOD_LABELS[v as keyof typeof PAYMENT_METHOD_LABELS] ?? (v as string)),
              },
              { key: "count", label: t("reports.count"), align: "right" },
              {
                key: "total",
                label: t("common.amount"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
              {
                key: "share",
                label: t("reports.share"),
                align: "right",
                format: (v) => `${(v as number).toFixed(1)}%`,
              },
            ]}
            data={byPaymentMethod.map((r) => ({
              ...r,
              share: totalMethodAmount > 0 ? (r.total / totalMethodAmount) * 100 : 0,
            })) as unknown as Record<string, unknown>[]}
            summaryRow={{
              method: "",
              count: totalMethodCount,
              total: totalMethodAmount,
              share: 100,
            }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Payment Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t("revenue.paymentStatusBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              {
                key: "status",
                label: t("common.status"),
                format: (v) => {
                  const cfg = PAYMENT_STATUS_CONFIG[v as keyof typeof PAYMENT_STATUS_CONFIG];
                  if (!cfg) return v as string;
                  return (
                    <Badge className={cfg.color} variant="secondary">
                      {t(cfg.labelKey)}
                    </Badge>
                  );
                },
              },
              { key: "count", label: t("common.orders"), align: "right" },
              {
                key: "totalAmount",
                label: t("reports.totalAmount"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
              {
                key: "paidAmount",
                label: t("reports.paidAmount"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
            ]}
            data={byPaymentStatus as unknown as Record<string, unknown>[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
