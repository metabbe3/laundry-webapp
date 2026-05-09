"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind color class for the icon (e.g. "text-blue-600") */
  iconColor?: string;
  /** Accent background for the icon container (e.g. "bg-blue-50 dark:bg-blue-950/50") */
  iconBg?: string;
  /** Extra content rendered below the value (trend badge, subtitle, etc.) */
  extra?: ReactNode;
}

export function StatCard({ title, value, icon: Icon, iconColor = "text-primary", iconBg = "bg-primary/10", extra }: StatCardProps) {
  return (
    <Card className="card-warm group border-0 bg-white/80 shadow-none dark:bg-[oklch(0.195_0.025_55/0.6)]">
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} transition-transform duration-200 group-hover:scale-105`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">{title}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {extra}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
