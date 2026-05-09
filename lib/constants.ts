import type { OrderStatus, PaymentStatus, PaymentMethod, PricingType, CommissionType, StockMovementType } from "@/app/generated/prisma/enums";

export const BUSINESS_NAME_KEY = "app.title";
export const BUSINESS_TAGLINE_KEY = "app.tagline";

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { labelKey: string; color: string }> = {
  RECEIVED: { labelKey: "status.received", color: "bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  IN_PROGRESS: { labelKey: "status.inProgress", color: "bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  READY: { labelKey: "status.ready", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  DELIVERED: { labelKey: "status.delivered", color: "bg-stone-100/80 text-stone-500 dark:bg-stone-800/50 dark:text-stone-400" },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { labelKey: string; color: string }> = {
  PENDING: { labelKey: "status.unpaid", color: "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300" },
  PARTIAL: { labelKey: "status.partial", color: "bg-orange-100/80 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300" },
  PAID: { labelKey: "status.paid", color: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "paymentMethod.cash",
  DEPOSIT: "paymentMethod.deposit",
  QRIS: "paymentMethod.qris",
};

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  PER_KG: "pricingType.perKg",
  PER_ITEM: "pricingType.perItem",
};

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  NONE: "commissionType.none",
  FLAT: "commissionType.flat",
  PERCENTAGE: "commissionType.percentage",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = ["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED"];

export type CustomerStatus = "ACTIVE" | "AT_RISK" | "LAPSED" | "NEW";

export const CUSTOMER_STATUS_CONFIG: Record<CustomerStatus, { labelKey: string; color: string }> = {
  ACTIVE: { labelKey: "status.active", color: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" },
  AT_RISK: { labelKey: "status.atRisk", color: "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" },
  LAPSED: { labelKey: "status.lapsed", color: "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300" },
  NEW: { labelKey: "status.new", color: "bg-sky-100/80 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" },
};

export const DATE_RANGE_PRESETS = [
  { labelKey: "dateRange.today", key: "today" },
  { labelKey: "dateRange.yesterday", key: "yesterday" },
  { labelKey: "dateRange.thisWeek", key: "thisWeek" },
  { labelKey: "dateRange.lastWeek", key: "lastWeek" },
  { labelKey: "dateRange.thisMonth", key: "thisMonth" },
  { labelKey: "dateRange.lastMonth", key: "lastMonth" },
  { labelKey: "dateRange.custom", key: "custom" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]["key"];

export function getDateRangePreset(key: DateRangePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = today.getDay();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((dayOfWeek + 6) % 7));

  switch (key) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "thisWeek":
      return { from: fmt(monday), to: fmt(today) };
    case "lastWeek": {
      const lastMonday = new Date(monday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(monday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    }
    case "thisMonth":
      return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
    case "lastMonth": {
      const firstOfLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLast = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(firstOfLast), to: fmt(lastOfLast) };
    }
    default:
      return { from: fmt(startOfDay(today)), to: fmt(today) };
  }
}

export const STOCK_MOVEMENT_TYPE_CONFIG: Record<StockMovementType, { labelKey: string; color: string }> = {
  IN: { labelKey: "reports.in", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  OUT: { labelKey: "reports.out", color: "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300" },
};
