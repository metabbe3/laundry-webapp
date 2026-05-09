"use client";

import { useEffect, useState } from "react";
import { DollarSign, Tag, TrendingDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";

interface ExpensesReportProps {
  from: string;
  to: string;
}

interface ExpensesData {
  summary: {
    totalExpenses: number;
    categoryCount: number;
    dailyAvg: number;
  };
  byCategory: { category: string; count: number; total: number }[];
  dailyTrend: { date: string; total: number; count: number }[];
}

export function ExpensesReport({ from, to }: ExpensesReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/reports/expenses?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, byCategory, dailyTrend } = data;

  const totalCategoryTotal = byCategory.reduce((s, r) => s + r.total, 0);
  const totalDailyTotal = dailyTrend.reduce((s, d) => s + d.total, 0);
  const totalDailyCount = dailyTrend.reduce((s, d) => s + d.count, 0);

  const csvHeaders = { date: t("common.date"), total: t("common.total"), count: t("reports.count") };
  const csvData = dailyTrend.map((d) => ({ date: formatDate(d.date), total: d.total, count: d.count }));
  const baseFilename = `expenses-report-${from}-to-${to}`;

  const summaryCards = [
    { title: t("expensesReport.totalExpenses"), value: formatCurrency(summary.totalExpenses), icon: DollarSign, iconColor: "text-rose-600", bgIconColor: "bg-rose-100 dark:bg-rose-900/30" },
    { title: t("expensesReport.categories"), value: String(summary.categoryCount), icon: Tag, iconColor: "text-violet-600", bgIconColor: "bg-violet-100 dark:bg-violet-900/30" },
    { title: t("expensesReport.dailyAverage"), value: formatCurrency(summary.dailyAvg), icon: TrendingDown, iconColor: "text-amber-600", bgIconColor: "bg-amber-100 dark:bg-amber-900/30" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
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

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => exportToCsv(csvData, `${baseFilename}.csv`, csvHeaders)}>
          <Download className="size-4" /> {t("common.exportCsv")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToXls(csvData, `${baseFilename}.xls`, "Expenses", csvHeaders)}>
          <FileSpreadsheet className="size-4" /> {t("common.exportXls")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToPdf("expenses", from, to)}>
          <FileText className="size-4" /> {t("common.exportPdf")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("expensesReport.byCategory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "category", label: t("common.category") },
              { key: "count", label: t("reports.entries"), align: "right" },
              { key: "total", label: t("common.total"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "share", label: t("reports.share"), align: "right", format: (v) => `${(v as number).toFixed(1)}%` },
            ]}
            data={byCategory.map((r) => ({
              ...r,
              share: totalCategoryTotal > 0 ? (r.total / totalCategoryTotal) * 100 : 0,
            })) as unknown as Record<string, unknown>[]}
            summaryRow={{ category: "", count: byCategory.reduce((s, r) => s + r.count, 0), total: totalCategoryTotal, share: 100 }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("expensesReport.dailyExpensesTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "date", label: t("common.date"), format: (v) => formatDate(v as string) },
              { key: "total", label: t("common.total"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "count", label: t("reports.entries"), align: "right" },
            ]}
            data={dailyTrend as unknown as Record<string, unknown>[]}
            summaryRow={{ date: "", total: totalDailyTotal, count: totalDailyCount }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
