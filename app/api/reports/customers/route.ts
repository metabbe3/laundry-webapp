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

  const { where } = buildDateFilter(fromStr, toStr);
  const fromDate = fromStr ? new Date(fromStr) : new Date(0);

  const [newCustomersCount, totalCustomers, topSpenders, firstOrderPerCustomer, outstandingOrders] = await Promise.all([
    // New customers in period
    prisma.customer.count({ where: { ...where, branchId } }),
    // Total customers
    prisma.customer.count({ where: { branchId } }),
    // Top spenders in period
    prisma.order.groupBy({
      by: ["customerId"],
      where: { ...where, branchId },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 20,
    }),
    // First order per customer (for new vs returning)
    prisma.order.groupBy({
      by: ["customerId"],
      _min: { createdAt: true },
      where: { branchId },
    }),
    // Outstanding balances
    prisma.order.findMany({
      where: { paymentStatus: { in: ["PENDING", "PARTIAL"] }, branchId },
      select: {
        customerId: true,
        customer: { select: { name: true, phone: true } },
        totalAmount: true,
        paidAmount: true,
      },
    }),
  ]);

  // Resolve top spender names
  const spenderIds = topSpenders.map((s) => s.customerId);
  const spenderCustomers = spenderIds.length > 0
    ? await prisma.customer.findMany({ where: { id: { in: spenderIds }, branchId }, select: { id: true, name: true } })
    : [];
  const spenderMap = new Map(spenderCustomers.map((c) => [c.id, c.name]));

  // New vs returning
  const firstOrderMap = new Map(firstOrderPerCustomer.map((f) => [f.customerId, f._min.createdAt]));
  let newCount = 0;
  let returningCount = 0;
  const uniqueCustomerIds = new Set(topSpenders.map((s) => s.customerId));
  for (const id of uniqueCustomerIds) {
    const firstDate = firstOrderMap.get(id);
    if (firstDate && firstDate >= fromDate) newCount++;
    else returningCount++;
  }

  // Aggregate outstanding by customer
  const outstandingMap = new Map<string, { name: string; phone: string; totalOutstanding: number; orderCount: number }>();
  for (const o of outstandingOrders) {
    const existing = outstandingMap.get(o.customerId);
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    if (existing) {
      existing.totalOutstanding += outstanding;
      existing.orderCount++;
    } else {
      outstandingMap.set(o.customerId, {
        name: o.customer.name,
        phone: o.customer.phone,
        totalOutstanding: outstanding,
        orderCount: 1,
      });
    }
  }

  const totalSpent = topSpenders.reduce((sum, s) => sum + Number(s._sum.totalAmount ?? 0), 0);

  return NextResponse.json({
    summary: {
      totalCustomers,
      newCustomers: newCustomersCount,
      newInPeriod: newCount,
      returningInPeriod: returningCount,
      avgSpendPerCustomer: uniqueCustomerIds.size > 0 ? Math.round(totalSpent / uniqueCustomerIds.size) : 0,
    },
    topSpenders: topSpenders.map((s) => ({
      customerId: s.customerId,
      name: spenderMap.get(s.customerId) ?? "Unknown",
      orders: s._count,
      totalSpent: Number(s._sum.totalAmount ?? 0),
    })),
    outstandingBalance: Array.from(outstandingMap.entries())
      .map(([id, data]) => ({ customerId: id, ...data }))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 20),
  });
}
