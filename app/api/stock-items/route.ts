import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { stockItemSchema } from "@/lib/validations";

export async function GET() {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const stockItems = await prisma.stockItem.findMany({
    where: { isActive: true, branchId },
    include: {
      _count: { select: { movements: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    stockItems.map((item) => ({
      ...item,
      currentQuantity: Number(item.currentQuantity),
      lowStockThreshold: Number(item.lowStockThreshold),
      purchasePricePerUnit: Number(item.purchasePricePerUnit),
    }))
  );
}

export async function POST(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  if (session.user.role !== "OWNER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = stockItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const stockItem = await prisma.stockItem.create({
    data: {
      ...parsed.data,
      branchId,
    },
  });

  return NextResponse.json(
    {
      ...stockItem,
      currentQuantity: Number(stockItem.currentQuantity),
      lowStockThreshold: Number(stockItem.lowStockThreshold),
      purchasePricePerUnit: Number(stockItem.purchasePricePerUnit),
    },
    { status: 201 }
  );
}
