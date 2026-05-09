import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";

export async function GET(request: NextRequest) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { searchParams } = request.nextUrl;

  // Parse date range, default to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const fromStr = searchParams.get("from") || todayStr;
  const toStr = searchParams.get("to") || todayStr;

  const from = new Date(fromStr);
  from.setHours(0, 0, 0, 0);

  const to = new Date(toStr);
  to.setHours(23, 59, 59, 999);

  // Calculate previous period for comparison
  const periodMs = to.getTime() - from.getTime() + 1; // +1 to include full day
  const previousTo = new Date(from.getTime() - 1);
  previousTo.setHours(23, 59, 59, 999);
  const previousFrom = new Date(previousTo.getTime() - periodMs + 1);
  previousFrom.setHours(0, 0, 0, 0);

  const [
    todayOrders,
    inProgress,
    readyForPickup,
    revenueResult,
    previousRevenueResult,
    recentOrders,
    topCustomersGrouped,
    serviceBreakdownGrouped,
    paymentBreakdown,
  ] = await Promise.all([
    prisma.order.count({ where: { branchId, createdAt: { gte: from, lte: to } } }),
    prisma.order.count({ where: { branchId, status: "IN_PROGRESS" } }),
    prisma.order.count({ where: { branchId, status: "READY" } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { order: { branchId }, createdAt: { gte: from, lte: to } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { order: { branchId }, createdAt: { gte: previousFrom, lte: previousTo } },
    }),
    prisma.order.findMany({
      where: { branchId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true } } },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { branchId, createdAt: { gte: from, lte: to } },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: { order: { branchId, createdAt: { gte: from, lte: to } } },
      _sum: { subtotal: true },
      _count: true,
      orderBy: { _sum: { subtotal: "desc" } },
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: { order: { branchId }, createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Fetch customer names for top customers
  const customerIds = topCustomersGrouped.map((tc) => tc.customerId);
  const customers = customerIds.length > 0
    ? await prisma.customer.findMany({
        where: { branchId, id: { in: customerIds } },
        select: { id: true, name: true },
      })
    : [];
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const topCustomers = topCustomersGrouped.map((tc) => ({
    customerId: tc.customerId,
    name: customerMap.get(tc.customerId) ?? "Unknown",
    orders: tc._count,
    totalSpent: Number(tc._sum.totalAmount ?? 0),
  }));

  // Fetch service names for breakdown
  const serviceIds = serviceBreakdownGrouped.map((sb) => sb.serviceId);
  const services = serviceIds.length > 0
    ? await prisma.service.findMany({
        where: { branchId, id: { in: serviceIds } },
        select: { id: true, name: true },
      })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  const serviceBreakdown = serviceBreakdownGrouped.map((sb) => ({
    serviceId: sb.serviceId,
    name: serviceMap.get(sb.serviceId) ?? "Unknown",
    orders: sb._count,
    revenue: Number(sb._sum.subtotal ?? 0),
  }));

  const paymentMethodBreakdown = paymentBreakdown.map((pb) => ({
    method: pb.paymentMethod,
    count: pb._count,
    total: Number(pb._sum.amount ?? 0),
  }));

  const currentRevenue = Number(revenueResult._sum.amount ?? 0);
  const previousRevenue = Number(previousRevenueResult._sum.amount ?? 0);
  const revenueChange = previousRevenue === 0 ? null : ((currentRevenue - previousRevenue) / previousRevenue) * 100;

  return NextResponse.json({
    todayOrders,
    inProgress,
    readyForPickup,
    todayRevenue: currentRevenue,
    previousRevenue,
    revenueChange,
    topCustomers,
    serviceBreakdown,
    paymentMethodBreakdown,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
