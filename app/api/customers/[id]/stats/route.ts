import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import type { CustomerStatus } from "@/lib/constants";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  if (fromStr) dateFilter.gte = new Date(fromStr);
  if (toStr) {
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    dateFilter.lte = to;
  }
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const orderWhere = {
    customerId: id,
    branchId,
    ...(hasDateFilter ? { createdAt: dateFilter } : {}),
  };

  const customer = await prisma.customer.findUnique({ where: { id, branchId }, select: { createdAt: true } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [
    orderStats,
    serviceBreakdownGrouped,
    paymentBreakdownGrouped,
    orderDates,
    lastOrderAllTime,
  ] = await Promise.all([
    // (a) Financial aggregates
    prisma.order.aggregate({
      where: orderWhere,
      _count: true,
      _sum: { totalAmount: true, paidAmount: true },
    }),

    // (b) Service breakdown
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: { order: orderWhere },
      _sum: { subtotal: true },
      _count: true,
      orderBy: { _sum: { subtotal: "desc" } },
    }),

    // (c) Payment method breakdown
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: { order: orderWhere },
      _sum: { amount: true },
      _count: true,
    }),

    // (d) Visit frequency (all-time, not filtered)
    prisma.order.findMany({
      where: { customerId: id, branchId },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),

    // (e) Last order all-time for status
    prisma.order.findFirst({
      where: { customerId: id, branchId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  // Resolve service names
  const serviceIds = serviceBreakdownGrouped.map((s) => s.serviceId);
  const services = serviceIds.length > 0
    ? await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true },
      })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  const totalSpent = Number(orderStats._sum.totalAmount ?? 0);
  const totalPaid = Number(orderStats._sum.paidAmount ?? 0);
  const totalOrders = orderStats._count;
  const outstandingBalance = totalSpent - totalPaid;
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

  // Visit frequency
  const now = Date.now();
  const daysSinceLastOrder = lastOrderAllTime
    ? Math.floor((now - lastOrderAllTime.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let avgDaysBetweenOrders: number | null = null;
  if (orderDates.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < orderDates.length; i++) {
      totalGap += orderDates[i].createdAt.getTime() - orderDates[i - 1].createdAt.getTime();
    }
    avgDaysBetweenOrders = Math.round(totalGap / (orderDates.length - 1) / (1000 * 60 * 60 * 24));
  }

  // Customer status (all-time, not filtered)
  let customerStatus: CustomerStatus;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;

  if (now - customer.createdAt.getTime() < thirtyDays && totalOrders === 0) {
    customerStatus = "NEW";
  } else if (!lastOrderAllTime) {
    customerStatus = "LAPSED";
  } else {
    const daysSince = now - lastOrderAllTime.createdAt.getTime();
    if (daysSince <= thirtyDays) {
      customerStatus = "ACTIVE";
    } else if (daysSince <= ninetyDays) {
      customerStatus = "AT_RISK";
    } else {
      customerStatus = "LAPSED";
    }
  }

  return NextResponse.json({
    totalOrders,
    totalSpent,
    totalPaid,
    outstandingBalance,
    avgOrderValue,
    daysSinceLastOrder,
    avgDaysBetweenOrders,
    customerStatus,
    serviceBreakdown: serviceBreakdownGrouped.map((s) => ({
      serviceId: s.serviceId,
      name: serviceMap.get(s.serviceId) ?? "Unknown",
      orderCount: s._count,
      totalRevenue: Number(s._sum.subtotal ?? 0),
    })),
    paymentMethodBreakdown: paymentBreakdownGrouped.map((p) => ({
      method: p.paymentMethod,
      count: p._count,
      total: Number(p._sum.amount ?? 0),
    })),
  });
}
