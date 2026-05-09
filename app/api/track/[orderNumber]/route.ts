import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "@/lib/constants";

export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      receivedAt: true,
      inProgressAt: true,
      readyAt: true,
      deliveredAt: true,
      customer: { select: { name: true } },
      orderItems: {
        select: {
          quantity: true,
          weightKg: true,
          service: { select: { name: true, pricingType: true } },
        },
      },
      branch: { select: { name: true, phone: true, address: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_CONFIG[order.status]?.labelKey ?? order.status,
    paymentStatusLabel: PAYMENT_STATUS_CONFIG[order.paymentStatus]?.labelKey ?? order.paymentStatus,
    customerName: order.customer.name,
    createdAt: order.createdAt.toISOString(),
    receivedAt: order.receivedAt?.toISOString() ?? null,
    inProgressAt: order.inProgressAt?.toISOString() ?? null,
    readyAt: order.readyAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    items: order.orderItems.map((item) => ({
      service: item.service.name,
      pricingType: item.service.pricingType,
      quantity: Number(item.quantity),
      weightKg: item.weightKg ? Number(item.weightKg) : null,
    })),
    branch: {
      name: order.branch.name,
      phone: order.branch.phone,
      address: order.branch.address,
    },
  });
}
