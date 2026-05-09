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

  const { hasFilter, dateFilter } = buildDateFilter(fromStr, toStr);
  const itemWhere = hasFilter ? { order: { createdAt: dateFilter, branchId } } : { order: { branchId } };

  const [serviceGroups, allServices] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: itemWhere,
      _sum: { quantity: true, weightKg: true, subtotal: true },
      _count: true,
      orderBy: { _sum: { subtotal: "desc" } },
    }),
    prisma.service.findMany({
      where: { isActive: true, branchId },
      select: { id: true, name: true, pricingType: true, basePrice: true },
    }),
  ]);

  const serviceMap = new Map(allServices.map((s) => [s.id, s]));

  const services = serviceGroups.map((g) => {
    const svc = serviceMap.get(g.serviceId);
    const totalRevenue = Number(g._sum.subtotal ?? 0);
    const orderCount = g._count;
    return {
      serviceId: g.serviceId,
      name: svc?.name ?? "Unknown",
      pricingType: svc?.pricingType ?? "PER_ITEM",
      basePrice: Number(svc?.basePrice ?? 0),
      orderCount,
      totalQuantity: Number(g._sum.quantity ?? 0),
      totalWeightKg: Number(g._sum.weightKg ?? 0),
      totalRevenue,
      avgOrderValue: orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
    };
  });

  // By pricing type — single pass
  const kg = { orderCount: 0, totalWeightKg: 0, revenue: 0 };
  const item = { orderCount: 0, totalQuantity: 0, revenue: 0 };
  for (const s of services) {
    if (s.pricingType === "PER_KG") {
      kg.orderCount += s.orderCount;
      kg.totalWeightKg += s.totalWeightKg;
      kg.revenue += s.totalRevenue;
    } else {
      item.orderCount += s.orderCount;
      item.totalQuantity += s.totalQuantity;
      item.revenue += s.totalRevenue;
    }
  }
  const byPricingType = { PER_KG: kg, PER_ITEM: item };

  return NextResponse.json({ services, byPricingType });
}
