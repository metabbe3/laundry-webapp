import { prisma } from "@/lib/prisma";
import { userCreateSchema } from "@/lib/validations";
import { requireOwnerAuth } from "@/lib/auth";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

export async function GET() {
  const err = await requireOwnerAuth();
  if (err) return err;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      branchId: true,
      createdAt: true,
      branch: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const err = await requireOwnerAuth();
  if (err) return err;

  const body = await req.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      role: parsed.data.role,
      branchId: parsed.data.branchId,
      passwordHash,
    },
    select: { id: true, email: true, name: true, phone: true, role: true, branchId: true, branch: { select: { name: true } } },
  });

  return NextResponse.json(user, { status: 201 });
}
