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

  const { where, hasFilter, dateFilter } = buildDateFilter(fromStr, toStr);
  const paymentWhere = hasFilter ? { order: { createdAt: dateFilter, branchId } } : { order: { branchId } };

  const [allOrders, paymentsByMethod, payments, ordersByPayStatus, ordersForDaily] = await Promise.all([
    // All orders aggregate
    prisma.order.aggregate({
      where: { ...where, branchId },
      _count: true,
      _sum: { totalAmount: true, discountAmount: true, paidAmount: true },
    }),
    // Payments by method
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: paymentWhere,
      _sum: { amount: true },
      _count: true,
    }),
    // All payments for daily trend
    prisma.payment.findMany({
      where: paymentWhere,
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),
    // Orders by payment status
    prisma.order.groupBy({
      by: ["paymentStatus"],
      where: { ...where, branchId },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    // Orders for daily order count
    prisma.order.findMany({
      where: { ...where, branchId },
      select: { createdAt: true, id: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const grossRevenue = Number(allOrders._sum.totalAmount ?? 0);
  const totalDiscount = Number(allOrders._sum.discountAmount ?? 0);
  const netRevenue = grossRevenue - totalDiscount;

  // Build daily trend
  const dailyMap = new Map<string, { revenue: number; orders: Set<string> }>();
  for (const o of ordersForDaily) {
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, orders: new Set() });
    dailyMap.get(day)!.orders.add(o.id);
  }
  for (const p of payments) {
    const day = new Date(p.createdAt).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, orders: new Set() });
    dailyMap.get(day)!.revenue += Number(p.amount);
  }
  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, revenue: data.revenue, orders: data.orders.size }));

  return NextResponse.json({
    summary: {
      grossRevenue,
      totalDiscount,
      netRevenue,
      totalPaid: Number(allOrders._sum.paidAmount ?? 0),
      ordersCount: allOrders._count,
    },
    byPaymentMethod: paymentsByMethod.map((p) => ({
      method: p.paymentMethod,
      count: p._count,
      total: Number(p._sum.amount ?? 0),
    })),
    dailyTrend,
    byPaymentStatus: ordersByPayStatus.map((o) => ({
      status: o.paymentStatus,
      count: o._count,
      totalAmount: Number(o._sum.totalAmount ?? 0),
      paidAmount: Number(o._sum.paidAmount ?? 0),
    })),
  });
}
