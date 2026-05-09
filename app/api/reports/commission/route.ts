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
    }),
    prisma.service.findMany({
      where: { branchId },
      select: { id: true, name: true, pricingType: true, commissionType: true, commissionValue: true },
    }),
  ]);

  const serviceMap = new Map(allServices.map((s) => [s.id, { ...s, commissionValue: Number(s.commissionValue) }]));

  const byService = serviceGroups.map((g) => {
    const svc = serviceMap.get(g.serviceId);
    const revenue = Number(g._sum.subtotal ?? 0);
    const totalQty = Number(g._sum.quantity ?? 0);
    const totalWeightKg = Number(g._sum.weightKg ?? 0);
    const commissionType = svc?.commissionType ?? "NONE";
    const commissionValue = Number(svc?.commissionValue ?? 0);

    let commission = 0;
    if (commissionType === "FLAT") {
      commission = svc?.pricingType === "PER_KG"
        ? commissionValue * totalWeightKg
        : commissionValue * totalQty;
    } else if (commissionType === "PERCENTAGE") {
      commission = revenue * (commissionValue / 100);
    }

    return {
      serviceId: g.serviceId,
      name: svc?.name ?? "Unknown",
      pricingType: svc?.pricingType ?? "PER_ITEM",
      orderCount: g._count,
      revenue,
      commissionType,
      commissionValue,
      commission: Math.round(commission),
    };
  });

  const totalRevenue = byService.reduce((sum, s) => sum + s.revenue, 0);
  const totalCommission = byService.reduce((sum, s) => sum + s.commission, 0);

  return NextResponse.json({
    summary: { totalRevenue, totalCommission },
    byService: byService.sort((a, b) => b.commission - a.commission),
  });
}
