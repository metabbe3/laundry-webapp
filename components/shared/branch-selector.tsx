"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { useSession } from "next-auth/react";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

export function BranchSelector() {
  const { isOwner, branchId, branchName } = useRole();
  const { update } = useSession();
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (!isOwner) return;
    fetch("/api/branches")
      .then((r) => r.ok ? r.json() : [])
      .then(setBranches)
      .catch(() => {});
  }, [isOwner]);

  if (!isOwner) return null;

  async function selectBranch(id: string) {
    const branch = branches.find((b) => b.id === id);
    await update({ selectedBranchId: id, selectedBranchName: branch?.name ?? "" });
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" size="sm" className="gap-2 max-w-[200px]" />
      }>
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{branchName || "Select Branch"}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => selectBranch(b.id)}
            className={b.id === branchId ? "font-semibold bg-accent" : ""}
          >
            {b.name}
            {!b.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
