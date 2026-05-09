import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { customerSchema } from "@/lib/validations";

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

  const customer = await prisma.customer.findUnique({
    where: { id, branchId },
    include: {
      orders: {
        where: hasDateFilter ? { createdAt: dateFilter } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          orderItems: { select: { id: true } },
          payments: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...customer,
    orders: customer.orders.map((o) => ({
      ...o,
      totalAmount: Number(o.totalAmount),
      paidAmount: Number(o.paidAmount),
      payments: o.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { id } = await params;
  const body = await req.json();
  const parsed = customerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.update({
      where: { id, branchId },
      data: parsed.data,
    });

    return NextResponse.json(customer);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error) {
      if ((error as { code: string }).code === "P2025") {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      if ((error as { code: string }).code === "P2002") {
        return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
      }
    }
    console.error("Failed to update customer:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { id } = await params;

  const orderCount = await prisma.order.count({ where: { customerId: id, branchId } });
  if (orderCount > 0) {
    return NextResponse.json({ error: "Cannot delete customer with existing orders" }, { status: 400 });
  }

  await prisma.customer.delete({ where: { id, branchId } });
  return NextResponse.json({ success: true });
}
