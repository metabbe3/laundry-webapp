import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { orderNotesUpdateSchema } from "@/lib/validations";
import { transformOrderDetailForRole } from "@/lib/order-transform";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id, branchId },
    include: {
      customer: true,
      orderItems: { include: { service: true } },
      payments: { orderBy: { createdAt: "desc" } },
      branch: { select: { name: true, address: true, phone: true, invoiceFooter: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isEmployee = session.user.role === "EMPLOYEE";

  return NextResponse.json(transformOrderDetailForRole(order, isEmployee));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { id } = await params;
  const body = await req.json();

  const parsed = orderNotesUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id, branchId } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  try {
    const order = await prisma.order.update({
      where: { id, branchId },
      data: { notes: parsed.data.notes },
    });

    return NextResponse.json({
      ...order,
      totalAmount: Number(order.totalAmount),
      paidAmount: Number(order.paidAmount),
      discountAmount: Number(order.discountAmount),
      discountType: order.discountType,
    });
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
