"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, DollarSign, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";

interface CustomersReportProps {
  from: string;
  to: string;
}

interface CustomerReportSummary {
  totalCustomers: number;
  newCustomers: number;
  newInPeriod: number;
  returningInPeriod: number;
  avgSpendPerCustomer: number;
}

interface TopSpender {
  customerId: string;
  name: string;
  orders: number;
  totalSpent: number;
}

interface OutstandingBalance {
  customerId: string;
  name: string;
  phone: string;
  totalOutstanding: number;
  orderCount: number;
}

interface CustomerReportData {
  summary: CustomerReportSummary;
  topSpenders: TopSpender[];
  outstandingBalance: OutstandingBalance[];
}

export function CustomersReport({ from, to }: CustomersReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/reports/customers?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, topSpenders, outstandingBalance } = data;

  // Pre-compute ranks for top spenders
  const spendersWithRank = topSpenders.map((s, i) => ({ ...s, rank: i + 1 }));

  const topSpendersSummary = {
    rank: "",
    name: t("common.total"),
    orders: spendersWithRank.reduce((sum, s) => sum + s.orders, 0),
    totalSpent: spendersWithRank.reduce((sum, s) => sum + s.totalSpent, 0),
  };

  const outstandingSummary = {
    customerId: "",
    name: t("common.total"),
    phone: "",
    totalOutstanding: outstandingBalance.reduce((sum, s) => sum + s.totalOutstanding, 0),
    orderCount: outstandingBalance.reduce((sum, s) => sum + s.orderCount, 0),
  };

  const csvHeaders: Record<string, string> = {
    name: t("common.name"),
    orders: t("common.orders"),
    totalSpent: t("customersReport.totalSpent"),
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4 text-blue-600" />
              {t("customersReport.totalCustomers")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="size-4 text-emerald-600" />
              {t("customersReport.newThisPeriod")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.newInPeriod}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4 text-amber-600" />
              {t("customersReport.returning")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.returningInPeriod}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="size-4 text-purple-600" />
              {t("customersReport.avgSpend")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.avgSpendPerCustomer)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Export Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportToCsv(
              spendersWithRank.map((s) => ({ name: s.name, orders: s.orders, totalSpent: s.totalSpent })),
              `customers-report-${from}-${to}.csv`,
              csvHeaders
            )
          }
        >
          <Download className="size-4" />
          {t("common.exportCsv")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportToXls(
              spendersWithRank.map((s) => ({ name: s.name, orders: s.orders, totalSpent: s.totalSpent })),
              `customers-report-${from}-${to}.xlsx`,
              "Customers",
              csvHeaders
            )
          }
        >
          <FileSpreadsheet className="size-4" />
          {t("common.exportXls")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToPdf("customers", from, to)}
        >
          <FileText className="size-4" />
          {t("common.exportPdf")}
        </Button>
      </div>

      {/* Top Spenders Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("customersReport.topSpenders")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              {
                key: "rank",
                label: "#",
                align: "center",
              },
              {
                key: "name",
                label: t("common.name"),
                align: "left",
                format: (v, row) => {
                  const id = (row as Record<string, unknown>).customerId as string;
                  if (!id) return v as string;
                  return (
                    <Link href={`/customers/${id}`} className="text-primary hover:underline">
                      {v as string}
                    </Link>
                  );
                },
              },
              { key: "orders", label: t("common.orders"), align: "right" },
              {
                key: "totalSpent",
                label: t("customersReport.totalSpent"),
                align: "right",
                format: (val: unknown) => formatCurrency(val as number),
              },
            ]}
            data={spendersWithRank as unknown as Record<string, unknown>[]}
            summaryRow={topSpendersSummary as unknown as Record<string, unknown>}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Outstanding Balances Table */}
      {outstandingBalance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("customersReport.outstandingBalances")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportTable
              columns={[
                {
                  key: "name",
                  label: t("common.customer"),
                  align: "left",
                  format: (v, row) => {
                    const id = (row as Record<string, unknown>).customerId as string;
                    if (!id) return v as string;
                    return (
                      <Link href={`/customers/${id}`} className="text-primary hover:underline">
                        {v as string}
                      </Link>
                    );
                  },
                },
                { key: "phone", label: t("common.phone"), align: "left" },
                {
                  key: "totalOutstanding",
                  label: t("customerDetails.outstanding"),
                  align: "right",
                  format: (val: unknown) => (
                    <span className="text-red-600 font-medium">
                      {formatCurrency(val as number)}
                    </span>
                  ),
                },
                { key: "orderCount", label: t("common.orders"), align: "right" },
              ]}
              data={outstandingBalance as unknown as Record<string, unknown>[]}
              summaryRow={outstandingSummary as unknown as Record<string, unknown>}
              summaryLabel={t("common.total")}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
