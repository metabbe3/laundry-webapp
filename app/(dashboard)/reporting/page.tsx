"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { RevenueReport } from "@/components/reports/revenue-report";
import { OrdersReport } from "@/components/reports/orders-report";
import { CustomersReport } from "@/components/reports/customers-report";
import { ServicesReport } from "@/components/reports/services-report";
import { CommissionReport } from "@/components/reports/commission-report";
import { OutstandingReport } from "@/components/reports/outstanding-report";
import { ExpensesReport } from "@/components/reports/expenses-report";
import { ProfitReport } from "@/components/reports/profit-report";
import { InventoryReport } from "@/components/reports/inventory-report";
import { getDateRangePreset } from "@/lib/constants";

export default function ReportingPage() {
  const router = useRouter();
  const { isEmployee, isLoading } = useRole();
  const { t } = useTranslation();

  const thisMonth = getDateRangePreset("thisMonth");
  const [from, setFrom] = useState(thisMonth.from);
  const [to, setTo] = useState(thisMonth.to);

  if (isLoading) return null;
  if (isEmployee) {
    router.replace("/orders");
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("reporting.title")} description={t("reporting.description")} />

      <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">{t("reporting.revenue")}</TabsTrigger>
          <TabsTrigger value="orders">{t("reporting.orders")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("reporting.expenses")}</TabsTrigger>
          <TabsTrigger value="profit">{t("reporting.profit")}</TabsTrigger>
          <TabsTrigger value="inventory">{t("reporting.inventory")}</TabsTrigger>
          <TabsTrigger value="customers">{t("reporting.customers")}</TabsTrigger>
          <TabsTrigger value="services">{t("reporting.services")}</TabsTrigger>
          <TabsTrigger value="commission">{t("reporting.commission")}</TabsTrigger>
          <TabsTrigger value="outstanding">{t("reporting.outstanding")}</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <RevenueReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="profit">
          <ProfitReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="commission">
          <CommissionReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="outstanding">
          <OutstandingReport from={from} to={to} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
