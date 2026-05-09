import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { statusUpdateSchema } from "@/lib/validations";

const timestampMap: Record<string, string> = {
  RECEIVED: "receivedAt",
  IN_PROGRESS: "inProgressAt",
  READY: "readyAt",
  DELIVERED: "deliveredAt",
};

const STATUS_FLOW: Record<string, string> = {
  RECEIVED: "IN_PROGRESS",
  IN_PROGRESS: "READY",
  READY: "DELIVERED",
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  const { id } = await params;
  const body = await req.json();
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const timestampField = timestampMap[parsed.data.status];

  // Validate status transition
  const current = await prisma.order.findUnique({ where: { id, branchId }, select: { status: true } });
  if (!current) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const allowedNext = STATUS_FLOW[current.status];
  if (parsed.data.status !== allowedNext) {
    return NextResponse.json({ error: `Invalid transition: ${current.status} → ${parsed.data.status}` }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id, branchId },
    data: {
      status: parsed.data.status,
      ...(timestampField ? { [timestampField]: new Date() } : {}),
    },
  });

  const isEmployee = session.user.role === "EMPLOYEE";

  return NextResponse.json({
    ...order,
    totalAmount: Number(order.totalAmount),
    paidAmount: isEmployee ? 0 : Number(order.paidAmount),
  });
}
