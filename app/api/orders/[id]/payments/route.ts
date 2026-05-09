import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { paymentSchema } from "@/lib/validations";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const payment = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id, branchId } });
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const remaining = Number(order.totalAmount) - Number(order.paidAmount);
    if (parsed.data.amount > remaining) throw new Error("AMOUNT_EXCEEDS_BALANCE");

    const newPayment = await tx.payment.create({
      data: {
        orderId: id,
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod,
        notes: parsed.data.notes,
      },
    });

    // Auto-update payment status
    const newPaidAmount = Number(order.paidAmount) + parsed.data.amount;
    let paymentStatus: "PENDING" | "PARTIAL" | "PAID";
    if (newPaidAmount >= Number(order.totalAmount)) {
      paymentStatus = "PAID";
    } else if (newPaidAmount > 0) {
      paymentStatus = "PARTIAL";
    } else {
      paymentStatus = "PENDING";
    }

    await tx.order.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        paymentStatus,
      },
    });

    return newPayment;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return null;
    }
    if (error instanceof Error && error.message === "AMOUNT_EXCEEDS_BALANCE") {
      return "AMOUNT_EXCEEDS_BALANCE" as const;
    }
    throw error;
  });

  if (payment === "AMOUNT_EXCEEDS_BALANCE") {
    return NextResponse.json({ error: "Payment amount exceeds remaining balance" }, { status: 400 });
  }
  if (!payment) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({ ...payment, amount: Number(payment.amount) }, { status: 201 });
}
