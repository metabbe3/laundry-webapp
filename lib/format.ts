export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Builds a Prisma date filter object from optional date strings.
 * @returns { where: Prisma date filter, hasFilter: true if dates were provided, dateFilter: raw date object for nesting }
 */
export function buildDateFilter(fromStr: string | null, toStr: string | null): {
  where: { createdAt?: { gte?: Date; lte?: Date } };
  hasFilter: boolean;
  dateFilter: { gte?: Date; lte?: Date };
} {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (fromStr) dateFilter.gte = new Date(fromStr);
  if (toStr) {
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    dateFilter.lte = to;
  }
  const hasFilter = Object.keys(dateFilter).length > 0;
  return { where: hasFilter ? { createdAt: dateFilter } : {}, hasFilter, dateFilter };
}
