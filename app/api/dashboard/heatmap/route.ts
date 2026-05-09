import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";

export async function GET(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (fromStr) dateFilter.gte = new Date(fromStr);
  if (toStr) {
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    dateFilter.lte = to;
  }
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const where = hasDateFilter ? { branchId, createdAt: dateFilter } : { branchId };

  const [orders, payments, customerOrders] = await Promise.all([
    // (a) All orders with createdAt for hourly/day grid
    prisma.order.findMany({
      where,
      select: { createdAt: true, totalAmount: true },
      orderBy: { createdAt: "asc" },
    }),

    // (b) Payments for revenue by day
    prisma.payment.findMany({
      where: { order: where },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),

    // (c) Customer orders for visit patterns
    prisma.order.findMany({
      where,
      select: {
        customerId: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // (1) Hourly by day-of-week: 7 rows (Mon=0..Sun=6) x 24 columns (0..23)
  const hourlyByDay: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const dow = (d.getDay() + 6) % 7; // Mon=0, Sun=6
    const hour = d.getHours();
    hourlyByDay[dow][hour]++;
  }

  // (2) Revenue by day: last N days
  const revenueByDay: Record<string, number> = {};
  for (const p of payments) {
    const day = new Date(p.createdAt).toISOString().slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(p.amount);
  }

  // (3) Customer visits: top 10 customers by frequency + day-of-week distribution
  const customerMap = new Map<string, { name: string; totalOrders: number; dayDistribution: number[] }>();
  for (const o of customerOrders) {
    const existing = customerMap.get(o.customerId);
    const dow = (new Date(o.createdAt).getDay() + 6) % 7;
    if (existing) {
      existing.totalOrders++;
      existing.dayDistribution[dow]++;
    } else {
      customerMap.set(o.customerId, {
        name: o.customer.name,
        totalOrders: 1,
        dayDistribution: Array(7).fill(0) as number[],
      });
      customerMap.get(o.customerId)!.dayDistribution[dow] = 1;
    }
  }
  const customerVisits = Array.from(customerMap.entries())
    .map(([id, data]) => ({ customerId: id, ...data }))
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 15);

  return NextResponse.json({
    hourlyByDay,
    revenueByDay,
    customerVisits,
  });
}
