"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Users, Receipt, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";

interface OutstandingReportProps {
  from: string;
  to: string;
}

interface OutstandingCustomer {
  customerId: string;
  name: string;
  phone: string;
  totalOutstanding: number;
  orderCount: number;
  oldestOrder: string;
}

interface OutstandingData {
  summary: {
    totalOutstanding: number;
    customersAffected: number;
    ordersAffected: number;
  };
  customers: OutstandingCustomer[];
}

export function OutstandingReport({ from, to }: OutstandingReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<OutstandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/reports/outstanding?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, customers } = data;
  const baseFilename = `outstanding-report-${from}-to-${to}`;

  const csvHeaders: Record<string, string> = {
    name: t("common.customer"),
    phone: t("common.phone"),
    totalOutstanding: t("customerDetails.outstanding"),
    orderCount: t("common.orders"),
    oldestOrder: t("reports.oldestUnpaid"),
  };

  const summaryRow = {
    customerId: "",
    name: t("common.total"),
    phone: "",
    totalOutstanding: summary.totalOutstanding,
    orderCount: summary.ordersAffected,
    oldestOrder: "",
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-2 bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-sm text-muted-foreground">{t("outstandingReport.totalOutstanding")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOutstanding)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-2 bg-amber-100 dark:bg-amber-900/30">
                <Users className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-sm text-muted-foreground">{t("outstandingReport.affectedCustomers")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.customersAffected}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-2 bg-orange-100 dark:bg-orange-900/30">
                <Receipt className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-sm text-muted-foreground">{t("outstandingReport.unpaidOrders")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.ordersAffected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Toolbar */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => exportToCsv(
          customers.map((c) => ({
            name: c.name,
            phone: c.phone,
            totalOutstanding: c.totalOutstanding,
            orderCount: c.orderCount,
            oldestOrder: formatDate(c.oldestOrder),
          })),
          `${baseFilename}.csv`, csvHeaders,
        )}>
          <Download className="size-4" />
          {t("common.exportCsv")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToXls(
          customers.map((c) => ({
            name: c.name,
            phone: c.phone,
            totalOutstanding: c.totalOutstanding,
            orderCount: c.orderCount,
            oldestOrder: formatDate(c.oldestOrder),
          })),
          `${baseFilename}.xls`, "Outstanding", csvHeaders,
        )}>
          <FileSpreadsheet className="size-4" />
          {t("common.exportXls")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToPdf("outstanding", from, to)}>
          <FileText className="size-4" />
          {t("common.exportPdf")}
        </Button>
      </div>

      {/* Outstanding by Customer */}
      <Card>
        <CardHeader>
          <CardTitle>{t("outstandingReport.balances")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              {
                key: "name",
                label: t("common.customer"),
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
              { key: "phone", label: t("common.phone") },
              {
                key: "totalOutstanding",
                label: t("customerDetails.outstanding"),
                align: "right",
                format: (v) => (
                  <span className="font-medium text-red-600">{formatCurrency(v as number)}</span>
                ),
              },
              { key: "orderCount", label: t("common.orders"), align: "right" },
              {
                key: "oldestOrder",
                label: t("reports.oldestUnpaid"),
                align: "right",
                format: (v) => v ? formatDate(v as string) : "",
              },
            ]}
            data={customers as unknown as Record<string, unknown>[]}
            summaryRow={summaryRow as unknown as Record<string, unknown>}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
