import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { buildDateFilter } from "@/lib/format";

export async function GET(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  // Revenue date filter uses createdAt on Order
  const { where: orderWhere } = buildDateFilter(fromStr, toStr);

  // Expense date filter uses the date field
  const expenseDateFilter: any = {};
  if (fromStr) expenseDateFilter.date = { ...expenseDateFilter.date, gte: new Date(fromStr) };
  if (toStr) expenseDateFilter.date = { ...expenseDateFilter.date, lte: new Date(toStr + "T23:59:59") };
  const expenseWhere = {
    branchId,
    ...(Object.keys(expenseDateFilter).length > 0 ? expenseDateFilter : {}),
  };

  const [orderAgg, expenseAgg, expensesByCategory, ordersForDaily, expensesForDaily] = await Promise.all([
    // Revenue from delivered orders (or all orders in range)
    prisma.order.aggregate({
      where: { ...orderWhere, branchId, status: "DELIVERED" },
      _sum: { totalAmount: true, discountAmount: true },
      _count: true,
    }),
    // Total expenses
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),
    // Expenses grouped by category
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: expenseWhere,
      _sum: { amount: true },
      _count: true,
    }),
    // Orders for daily revenue trend
    prisma.order.findMany({
      where: { ...orderWhere, branchId, status: "DELIVERED" },
      select: { createdAt: true, totalAmount: true, discountAmount: true },
      orderBy: { createdAt: "asc" },
    }),
    // Expenses for daily expense trend
    prisma.expense.findMany({
      where: expenseWhere,
      select: { date: true, amount: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const totalRevenue = Number(orderAgg._sum.totalAmount ?? 0) - Number(orderAgg._sum.discountAmount ?? 0);
  const totalExpenses = Number(expenseAgg._sum.amount ?? 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Resolve category names
  const categoryIds = expensesByCategory.map((c) => c.categoryId);
  const categories = categoryIds.length > 0
    ? await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Build combined daily trend
  const dailyMap = new Map<string, { revenue: number; expenses: number }>();

  for (const o of ordersForDaily) {
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, expenses: 0 });
    const entry = dailyMap.get(day)!;
    entry.revenue += Number(o.totalAmount) - Number(o.discountAmount);
  }

  for (const e of expensesForDaily) {
    const day = new Date(e.date).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, expenses: 0 });
    dailyMap.get(day)!.expenses += Number(e.amount);
  }

  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      expenses: data.expenses,
      profit: data.revenue - data.expenses,
    }));

  return NextResponse.json({
    summary: {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit,
      marginPercent: profitMargin,
    },
    dailyComparison: dailyTrend,
  });
}
