import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { orderSchema } from "@/lib/validations";
import { transformOrderForRole } from "@/lib/order-transform";
import { type Prisma } from "@/app/generated/prisma/client";

export async function GET(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const paymentStatus = searchParams.get("paymentStatus");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const validStatuses = ["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED"];
  if (status && status !== "ALL" && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  // Build orderBy
  let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: "desc" };
  if (sortBy === "totalAmount") orderBy = { totalAmount: sortOrder as "asc" | "desc" };
  else if (sortBy === "customerName") orderBy = { customer: { name: sortOrder as "asc" | "desc" } };
  else orderBy = { createdAt: sortOrder as "asc" | "desc" };

  // Build date filter
  const dateFilter: Prisma.DateTimeFilter = {};
  if (dateFrom || dateTo) {
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }
  }

  const where: Prisma.OrderWhereInput = {
    branchId,
    ...(status && status !== "ALL" ? { status: status as Prisma.EnumOrderStatusFilter<"Order"> } : {}),
    ...(paymentStatus && ["PENDING", "PARTIAL", "PAID"].includes(paymentStatus) ? { paymentStatus: paymentStatus as Prisma.EnumPaymentStatusFilter<"Order"> } : {}),
    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search } },
            { customer: { name: { contains: search } } },
            { customer: { phone: { contains: search } } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        orderItems: { include: { service: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  const isEmployee = session.user.role === "EMPLOYEE";

  return NextResponse.json({
    orders: orders.map((o) => transformOrderForRole(o, isEmployee)),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Employees cannot apply discounts
  if (session.user.role === "EMPLOYEE" && (parsed.data.discountType || parsed.data.discountAmount)) {
    return NextResponse.json({ error: "Only owners can apply discounts" }, { status: 403 });
  }

  const services = await prisma.service.findMany({
    where: { id: { in: parsed.data.items.map((i) => i.serviceId) } },
  });
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  // Validate all service IDs exist
  const missingServiceIds = parsed.data.items
    .filter((item) => !serviceMap.has(item.serviceId))
    .map((item) => item.serviceId);
  if (missingServiceIds.length > 0) {
    return NextResponse.json(
      { error: `Services not found: ${missingServiceIds.join(", ")}` },
      { status: 400 }
    );
  }

  const orderItems = parsed.data.items.map((item) => {
    const service = serviceMap.get(item.serviceId)!;

    const pricePerUnit = Number(service.basePrice);
    const quantity = item.quantity;
    const weightKg = item.weightKg;
    const subtotal =
      service.pricingType === "PER_KG"
        ? pricePerUnit * (weightKg ?? 0)
        : pricePerUnit * quantity;

    return {
      serviceId: item.serviceId,
      quantity,
      weightKg,
      pricePerUnit,
      subtotal,
      notes: item.notes,
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.subtotal, 0);

  // Calculate discount
  const discountType = parsed.data.discountType;
  const discountInput = parsed.data.discountAmount ?? 0;
  let discount = 0;
  if (discountType === "PERCENTAGE" && discountInput > 0) {
    discount = subtotal * discountInput / 100;
  } else if (discountType === "FIXED" && discountInput > 0) {
    discount = Math.min(discountInput, subtotal);
  }

  const totalAmount = subtotal - discount;

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Generate order number: ORD-YYYYMMDD-XXXX
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const prefix = `ORD-${dateStr}-`;

      const lastOrder = await tx.order.findFirst({
        where: { orderNumber: { startsWith: prefix }, branchId },
        orderBy: { orderNumber: "desc" },
      });

      const nextNum = lastOrder
        ? parseInt(lastOrder.orderNumber.slice(-4)) + 1
        : 1;
      const orderNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;

      return tx.order.create({
        data: {
          branchId,
          orderNumber,
          customerId: parsed.data.customerId,
          totalAmount,
          discountAmount: discount,
          discountType: discountType ?? null,
          receivedAt: new Date(),
          notes: parsed.data.notes,
          orderItems: {
            create: orderItems.map((item) => ({
              serviceId: item.serviceId,
              quantity: item.quantity,
              weightKg: item.weightKg,
              pricePerUnit: item.pricePerUnit,
              subtotal: item.subtotal,
              notes: item.notes,
            })),
          },
        },
        include: {
          customer: true,
          orderItems: { include: { service: true } },
        },
      });
    });

    return NextResponse.json({
      ...order,
      totalAmount: Number(order.totalAmount),
      paidAmount: Number(order.paidAmount),
      discountAmount: Number(order.discountAmount),
      discountType: order.discountType,
      orderItems: order.orderItems.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        weightKg: i.weightKg ? Number(i.weightKg) : null,
        pricePerUnit: Number(i.pricePerUnit),
        subtotal: Number(i.subtotal),
      })),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create order:", error);
    const message = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
