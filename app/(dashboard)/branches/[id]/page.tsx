"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Users, ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";

interface BranchUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface BranchDetail {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  users: BranchUser[];
  _count: { orders: number; services: number; customers: number };
}

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { isOwner, isLoading: roleLoading } = useRole();
  const { t } = useTranslation();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isOwner) router.replace("/");
  }, [isOwner, roleLoading, router]);

  useEffect(() => {
    if (roleLoading || !isOwner) return;
    params.then(({ id }) => {
      fetch(`/api/branches/${id}`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(setBranch)
        .catch(() => toast.error(t("branchDetails.failedLoad")))
        .finally(() => setLoading(false));
    });
  }, [params, roleLoading, isOwner, t]);

  if (roleLoading || !isOwner) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!branch) return <p className="text-center py-12 text-muted-foreground">{t("branchDetails.notFound")}</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/branches")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{branch.name}</h1>
            <Badge variant={branch.isActive ? "default" : "secondary"} className={branch.isActive ? "bg-[oklch(0.72_0.17_75)] text-white" : ""}>
              {branch.isActive ? t("status.active") : t("status.inactive")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("branchDetails.detailsAndStaff")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[oklch(0.72_0.17_75)]" />
              <p className="text-sm text-muted-foreground">{t("branchDetails.orders")}</p>
            </div>
            <p className="text-2xl font-bold mt-1">{branch._count.orders}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[oklch(0.68_0.12_40)]" />
              <p className="text-sm text-muted-foreground">{t("branchDetails.services")}</p>
            </div>
            <p className="text-2xl font-bold mt-1">{branch._count.services}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[oklch(0.55_0.18_30)]" />
              <p className="text-sm text-muted-foreground">{t("branchDetails.customers")}</p>
            </div>
            <p className="text-2xl font-bold mt-1">{branch._count.customers}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
        <CardHeader><CardTitle className="text-base">{t("branchDetails.information")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: t("common.name"), value: branch.name },
              { label: t("common.phone"), value: branch.phone },
              { label: t("branches.address"), value: branch.address },
              { label: t("branchDetails.created"), value: new Date(branch.createdAt).toLocaleDateString() },
            ].map((field) => (
              <div key={field.label} className="space-y-1">
                <p className="text-sm text-muted-foreground">{field.label}</p>
                <p className={`font-medium ${!field.value ? "text-muted-foreground italic" : ""}`}>
                  {field.value || t("common.notProvided")}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
        <CardHeader><CardTitle className="text-base">{t("branchDetails.assignedStaff")} ({branch.users.length})</CardTitle></CardHeader>
        <CardContent>
          {branch.users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t("branchDetails.noStaff")}</p>
          ) : (
            <div className="space-y-3">
              {branch.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/40 p-3">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant={u.role === "OWNER" ? "default" : "secondary"} className={u.role === "OWNER" ? "bg-[oklch(0.72_0.17_75)] text-white" : ""}>
                    {u.role === "OWNER" ? t("role.owner") : t("role.employee")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
