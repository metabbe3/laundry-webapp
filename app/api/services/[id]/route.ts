import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { serviceSchema } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = serviceSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const service = await prisma.service.update({
    where: { id, branchId },
    data: parsed.data,
  });

  return NextResponse.json({ ...service, basePrice: Number(service.basePrice), commissionValue: Number(service.commissionValue) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  await prisma.service.update({
    where: { id, branchId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
