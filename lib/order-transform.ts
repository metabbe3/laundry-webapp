import type { Prisma } from "@/app/generated/prisma/client";

type OrderWithIncludes = Prisma.OrderGetPayload<{
  include: {
    customer: { select: { name: true; phone: true } };
    orderItems: { include: { service: true } };
  };
}>;

type OrderDetailWithIncludes = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    orderItems: { include: { service: true } };
    payments: { orderBy: { createdAt: "desc" } };
  };
}>;

export function transformOrderForRole(order: OrderWithIncludes, isEmployee: boolean) {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    paidAmount: isEmployee ? 0 : Number(order.paidAmount),
    discountAmount: isEmployee ? 0 : Number(order.discountAmount),
    discountType: isEmployee ? null : order.discountType,
    paymentStatus: isEmployee ? ("PENDING" as const) : order.paymentStatus,
    orderItems: order.orderItems.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      weightKg: i.weightKg ? Number(i.weightKg) : null,
      pricePerUnit: Number(i.pricePerUnit),
      subtotal: Number(i.subtotal),
    })),
  };
}

export function transformOrderDetailForRole(order: OrderDetailWithIncludes, isEmployee: boolean) {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    paidAmount: isEmployee ? 0 : Number(order.paidAmount),
    discountAmount: isEmployee ? 0 : Number(order.discountAmount),
    discountType: isEmployee ? null : order.discountType,
    paymentStatus: isEmployee ? ("PENDING" as const) : order.paymentStatus,
    orderItems: order.orderItems.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      weightKg: i.weightKg ? Number(i.weightKg) : null,
      pricePerUnit: Number(i.pricePerUnit),
      subtotal: Number(i.subtotal),
    })),
    payments: isEmployee ? [] : order.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };
}
