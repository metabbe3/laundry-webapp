import { prisma } from "@/lib/prisma";
import { branchSchema } from "@/lib/validations";
import { requireOwnerAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireOwnerAuth();
  if (err) return err;

  const { id } = await params;
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { orders: true, services: true, customers: true } },
    },
  });

  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(branch);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireOwnerAuth();
  if (err) return err;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = branchSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const branch = await prisma.branch.update({ where: { id }, data: parsed.data });
    return NextResponse.json(branch);
  } catch {
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}
