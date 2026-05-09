import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { stockMovementSchema } from "@/lib/validations";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { id } = await params;

  // Verify stock item belongs to the user's branch
  const stockItem = await prisma.stockItem.findFirst({
    where: { id, branchId },
  });
  if (!stockItem) {
    return NextResponse.json(
      { error: "Stock item not found" },
      { status: 404 }
    );
  }

  const movements = await prisma.stockMovement.findMany({
    where: { stockItemId: id },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(
    movements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
    }))
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId, session } = bf;

  if (session.user.role !== "OWNER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Verify stock item belongs to the user's branch
  const stockItem = await prisma.stockItem.findFirst({
    where: { id, branchId },
  });
  if (!stockItem) {
    return NextResponse.json(
      { error: "Stock item not found" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const parsed = stockMovementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { type, quantity, notes, date } = parsed.data;

  try {
    const movement = await prisma.$transaction(async (tx) => {
      // Re-fetch stock item inside transaction for current quantity
      const currentItem = await tx.stockItem.findUniqueOrThrow({
        where: { id },
      });

      if (type === "OUT" && Number(currentItem.currentQuantity) < quantity) {
        throw new Error(
          "Insufficient stock. Current quantity: " +
            Number(currentItem.currentQuantity)
        );
      }

      const newMovement = await tx.stockMovement.create({
        data: {
          stockItemId: id,
          type,
          quantity,
          notes: notes ?? null,
          date: new Date(date),
        },
      });

      await tx.stockItem.update({
        where: { id },
        data: {
          currentQuantity: {
            [type === "IN" ? "increment" : "decrement"]: quantity,
          },
        },
      });

      return newMovement;
    });

    return NextResponse.json(
      {
        ...movement,
        quantity: Number(movement.quantity),
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to record movement";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
