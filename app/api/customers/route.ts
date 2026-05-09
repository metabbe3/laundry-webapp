import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { customerSchema } from "@/lib/validations";
import type { CustomerStatus } from "@/lib/constants";

export async function GET(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";
  const statusFilter = searchParams.get("status") || "";

  const customers = await prisma.customer.findMany({
    where: {
      branchId,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      orders: {
        select: { totalAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;

  const enriched = customers.map((c) => {
    const totalOrders = c.orders.length;
    const totalSpent = c.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const lastOrderDate = c.orders.length > 0 ? c.orders[0].createdAt : null;

    let customerStatus: CustomerStatus;
    if (now - c.createdAt.getTime() < thirtyDays && totalOrders === 0) {
      customerStatus = "NEW";
    } else if (!lastOrderDate) {
      customerStatus = "LAPSED";
    } else {
      const daysSince = now - lastOrderDate.getTime();
      if (daysSince <= thirtyDays) customerStatus = "ACTIVE";
      else if (daysSince <= ninetyDays) customerStatus = "AT_RISK";
      else customerStatus = "LAPSED";
    }

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      createdAt: c.createdAt,
      totalOrders,
      totalSpent,
      lastOrderDate,
      customerStatus,
    };
  });

  const filtered = statusFilter
    ? enriched.filter((c) => c.customerStatus === statusFilter)
    : enriched;

  filtered.sort((a, b) => {
    const dir = order === "asc" ? 1 : -1;
    switch (sort) {
      case "name": return dir * a.name.localeCompare(b.name);
      case "orderCount": return dir * (a.totalOrders - b.totalOrders);
      case "totalSpent": return dir * (a.totalSpent - b.totalSpent);
      case "lastOrderDate":
        if (!a.lastOrderDate && !b.lastOrderDate) return 0;
        if (!a.lastOrderDate) return dir * 1;
        if (!b.lastOrderDate) return dir * -1;
        return dir * (a.lastOrderDate.getTime() - b.lastOrderDate.getTime());
      default: return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  });

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const body = await req.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.customer.findFirst({ where: { phone: parsed.data.phone, branchId } });
  if (existing) {
    return NextResponse.json({ error: "Customer with this phone already exists" }, { status: 400 });
  }

  const customer = await prisma.customer.create({ data: { ...parsed.data, branchId } });
  return NextResponse.json(customer, { status: 201 });
}
