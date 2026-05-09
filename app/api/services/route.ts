import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { serviceSchema } from "@/lib/validations";

export async function GET() {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const services = await prisma.service.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(services.map((s) => ({
    ...s,
    basePrice: Number(s.basePrice),
    commissionValue: Number(s.commissionValue),
  })));
}

export async function POST(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: {
      ...parsed.data,
      branchId,
    },
  });

  return NextResponse.json({ ...service, basePrice: Number(service.basePrice), commissionValue: Number(service.commissionValue) }, { status: 201 });
}
