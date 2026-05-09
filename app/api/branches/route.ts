import { prisma } from "@/lib/prisma";
import { branchSchema } from "@/lib/validations";
import { requireOwnerAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const err = await requireOwnerAuth();
  if (err) return err;

  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, orders: true, services: true, customers: true } },
    },
  });

  return NextResponse.json(branches);
}

export async function POST(req: Request) {
  const err = await requireOwnerAuth();
  if (err) return err;

  try {
    const body = await req.json();
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const branch = await prisma.branch.create({ data: parsed.data });
    return NextResponse.json(branch, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
