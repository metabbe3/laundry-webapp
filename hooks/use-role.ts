"use client";

import { useSession } from "next-auth/react";
import type { UserRole } from "@/app/generated/prisma/enums";

export function useRole() {
  const { data: session, status, update } = useSession();
  const isLoading = status === "loading";
  const role = isLoading ? null : (session?.user?.role ?? "EMPLOYEE" as UserRole);
  return {
    role,
    isOwner: role === "OWNER",
    isEmployee: role === "EMPLOYEE",
    isLoading,
    branchId: session?.user?.branchId ?? "",
    branchName: session?.user?.branchName ?? "",
    updateSession: update,
  };
}
