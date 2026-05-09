"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { BranchSelector } from "@/components/shared/branch-selector";
import { useTranslation } from "@/hooks/use-translation";

function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser API on mount, must sync state after SSR
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function Header() {
  const { data: session } = useSession();
  const { isOwner } = useRole();
  const { t } = useTranslation();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <header className="flex h-13 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-sm">
      <SidebarTrigger className="h-8 w-8 rounded-lg transition-colors hover:bg-accent/60 [&>svg]:h-4 [&>svg]:w-4" />
      <Separator orientation="vertical" className="h-5 bg-border/60" />
      <div className="flex-1" />
      <BranchSelector />
      <DarkModeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground" />
        }>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="hidden text-[13px] font-medium sm:inline">{session?.user?.name ?? "User"}</span>
            <Badge
              variant={isOwner ? "default" : "secondary"}
              className="border-0 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary"
            >
              {isOwner ? t("role.owner") : t("role.employee")}
            </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem onClick={handleSignOut} className="rounded-lg">
            <LogOut className="mr-2 h-4 w-4" />
            {t("header.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
