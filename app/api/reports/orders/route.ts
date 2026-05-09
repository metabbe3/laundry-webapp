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
  const itemWhere = hasFilter ? { order: { createdAt: dateFilter, branchId } } : { order: { branchId } };

  const [statusGroups, deliveredOrders, totalOrders, serviceGroups, orderDates] = await Promise.all([
    // Status distribution
    prisma.order.groupBy({
      by: ["status"],
      where: { ...where, branchId },
      _count: true,
      _sum: { totalAmount: true },
    }),
    // Delivered orders for turnaround
    prisma.order.findMany({
      where: { ...where, deliveredAt: { not: null }, branchId },
      select: { createdAt: true, deliveredAt: true },
    }),
    // Total count
    prisma.order.count({ where: { ...where, branchId } }),
    // Service breakdown via order items
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: itemWhere,
      _sum: { quantity: true, weightKg: true, subtotal: true },
      _count: true,
    }),
    // Orders for daily volume
    prisma.order.findMany({
      where: { ...where, branchId },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Resolve service names
  const serviceIds = serviceGroups.map((s) => s.serviceId);
  const services = serviceIds.length > 0
    ? await prisma.service.findMany({ where: { id: { in: serviceIds }, branchId }, select: { id: true, name: true, pricingType: true } })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  // Turnaround calculation
  const turnaroundHours = deliveredOrders
    .map((o) => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60))
    .filter((h) => h >= 0);
  const avgTurnaround = turnaroundHours.length > 0
    ? turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length
    : null;

  const turnaroundDistribution = {
    under24h: turnaroundHours.filter((h) => h < 24).length,
    under48h: turnaroundHours.filter((h) => h >= 24 && h < 48).length,
    under72h: turnaroundHours.filter((h) => h >= 48 && h < 72).length,
    over72h: turnaroundHours.filter((h) => h >= 72).length,
  };

  // Daily volume
  const dailyMap = new Map<string, number>();
  for (const o of orderDates) {
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  const dailyVolume = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const totalItems = serviceGroups.reduce((sum, s) => sum + Number(s._sum.quantity ?? 0), 0);
  const totalWeightKg = serviceGroups.reduce((sum, s) => sum + Number(s._sum.weightKg ?? 0), 0);

  return NextResponse.json({
    summary: { totalOrders, avgTurnaroundHours: avgTurnaround ? Math.round(avgTurnaround * 10) / 10 : null, totalItems, totalWeightKg: Math.round(totalWeightKg * 100) / 100 },
    byStatus: statusGroups.map((s) => ({ status: s.status, count: s._count, totalAmount: Number(s._sum.totalAmount ?? 0) })),
    serviceBreakdown: serviceGroups.map((s) => {
      const svc = serviceMap.get(s.serviceId);
      return {
        serviceId: s.serviceId,
        name: svc?.name ?? "Unknown",
        pricingType: svc?.pricingType ?? "PER_ITEM",
        orderCount: s._count,
        quantity: Number(s._sum.quantity ?? 0),
        weightKg: Number(s._sum.weightKg ?? 0),
        revenue: Number(s._sum.subtotal ?? 0),
      };
    }).sort((a, b) => b.revenue - a.revenue),
    turnaroundDistribution,
    dailyVolume,
  });
}
