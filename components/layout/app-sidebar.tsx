"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Sparkles,
  BarChart3,
  Building2,
  UserCog,
  Package,
  Receipt,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { LanguageToggle } from "@/components/shared/language-toggle";

const navItems = [
  { titleKey: "nav.dashboard", href: "/", icon: LayoutDashboard, color: "text-amber-600" },
  { titleKey: "nav.orders", href: "/orders", icon: ShoppingCart, color: "text-sky-600" },
  { titleKey: "nav.customers", href: "/customers", icon: Users, color: "text-amber-600" },
  { titleKey: "nav.services", href: "/services", icon: Sparkles, color: "text-emerald-600" },
  { titleKey: "nav.inventory", href: "/inventory", icon: Package, color: "text-teal-600" },
  { titleKey: "nav.expenses", href: "/expenses", icon: Receipt, color: "text-rose-600" },
  { titleKey: "nav.reporting", href: "/reporting", icon: BarChart3, color: "text-violet-600" },
];

const adminItems = [
  { titleKey: "nav.branches", href: "/branches", icon: Building2, color: "text-orange-600" },
  { titleKey: "nav.users", href: "/users", icon: UserCog, color: "text-purple-600" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isEmployee, isOwner } = useRole();
  const { t } = useTranslation();

  const visibleItems = isEmployee
    ? navItems.filter((item) => !["/services", "/reporting", "/inventory", "/expenses"].includes(item.href))
    : navItems;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border/60 px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="animate-amber-glow flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.72_0.17_75)] to-[oklch(0.65_0.19_65)] shadow-md shadow-[oklch(0.72_0.17_75/0.2)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-white"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 2C8 2 4 6 4 10c0 3 2 5 4 6v4a2 2 0 002 2h4a2 2 0 002-2v-4c2-1 4-3 4-6 0-4-4-8-8-8z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">{t("app.title")}</span>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("app.tagline")}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            {t("nav.menu")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<a href={item.href} />}
                      className={`group relative rounded-lg transition-all duration-200 hover:bg-sidebar-accent/60 ${
                        isActive
                          ? "bg-sidebar-accent/80 font-semibold shadow-sm"
                          : ""
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[oklch(0.72_0.17_75)] to-[oklch(0.65_0.19_65)]" />
                      )}
                      <item.icon className={`h-[18px] w-[18px] transition-colors ${isActive ? item.color : "text-muted-foreground group-hover:text-foreground"}`} />
                      <span className={`text-[13px] ${isActive ? "text-foreground" : ""}`}>{t(item.titleKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {t("nav.admin")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<a href={item.href} />}
                        className={`group relative rounded-lg transition-all duration-200 hover:bg-sidebar-accent/60 ${
                          isActive
                            ? "bg-sidebar-accent/80 font-semibold shadow-sm"
                            : ""
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[oklch(0.72_0.17_75)] to-[oklch(0.65_0.19_65)]" />
                        )}
                        <item.icon className={`h-[18px] w-[18px] transition-colors ${isActive ? item.color : "text-muted-foreground group-hover:text-foreground"}`} />
                        <span className={`text-[13px] ${isActive ? "text-foreground" : ""}`}>{t(item.titleKey)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
