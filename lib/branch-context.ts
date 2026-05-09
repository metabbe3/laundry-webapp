import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function getBranchFilter() {
  const session = await auth();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { branchId: session.user.branchId, session };
}
