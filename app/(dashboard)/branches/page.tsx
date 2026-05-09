"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Pencil, Building2, Users, ShoppingCart, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  invoiceFooter: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; orders: number; services: number; customers: number };
}

export default function BranchesPage() {
  const router = useRouter();
  const { isOwner, isLoading: roleLoading } = useRole();
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", invoiceFooter: "" });

  useEffect(() => {
    if (!roleLoading && !isOwner) router.replace("/");
  }, [isOwner, roleLoading, router]);

  useEffect(() => {
    if (!roleLoading && isOwner) loadBranches();
  }, [roleLoading, isOwner]);

  function loadBranches() {
    fetch("/api/branches")
      .then((r) => r.ok ? r.json() : [])
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }

  if (roleLoading || !isOwner) return null;
  if (loading) return <PageLoading />;

  function openCreate() {
    setEditing(null);
    setForm({ name: "", address: "", phone: "", invoiceFooter: "" });
    setDialogOpen(true);
  }

  function openEdit(b: Branch, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(b);
    setForm({ name: b.name, address: b.address || "", phone: b.phone || "", invoiceFooter: b.invoiceFooter || "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name: form.name, address: form.address || undefined, phone: form.phone || undefined, invoiceFooter: form.invoiceFooter || undefined };

    try {
      const url = editing ? `/api/branches/${editing.id}` : "/api/branches";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || t("branches.failedSave"));
        return;
      }

      toast.success(editing ? t("branches.updated") : t("branches.created"));
      setDialogOpen(false);
      loadBranches();
    } catch {
      toast.error(t("common.networkError"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("branches.title")} description={t("branches.description")} action={{ label: t("branches.addBranch"), onClick: openCreate }} />

      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("branches.noBranches")}
          description={t("branches.noBranchesDesc")}
          action={{ label: t("branches.addBranch"), onClick: openCreate }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <Link key={b.id} href={`/branches/${b.id}`}>
              <Card className={`border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl hover:shadow-md transition-all cursor-pointer h-full card-warm ${!b.isActive ? "opacity-60" : ""}`}>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.93_0.035_80)] dark:bg-[oklch(0.28_0.04_65)]">
                        <Building2 className="h-4 w-4 text-[oklch(0.72_0.17_75)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{b.name}</p>
                        {b.address && <p className="text-xs text-muted-foreground truncate">{b.address}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={b.isActive ? "default" : "secondary"} className={`text-[10px] ${b.isActive ? "bg-[oklch(0.72_0.17_75)] text-white" : ""}`}>
                        {b.isActive ? t("status.active") : t("status.inactive")}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(b, e)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-[oklch(0.72_0.17_75)]" />
                      <div>
                        <p className="text-sm font-bold">{b._count.users}</p>
                        <p className="text-[10px] text-muted-foreground">{t("branches.staff")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-3.5 w-3.5 text-[oklch(0.68_0.12_40)]" />
                      <div>
                        <p className="text-sm font-bold">{b._count.orders}</p>
                        <p className="text-[10px] text-muted-foreground">{t("branches.orders")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-[oklch(0.55_0.18_30)]" />
                      <div>
                        <p className="text-sm font-bold">{b._count.services}</p>
                        <p className="text-[10px] text-muted-foreground">{t("branches.services")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-[oklch(0.75_0.10_95)]" />
                      <div>
                        <p className="text-sm font-bold">{b._count.customers}</p>
                        <p className="text-[10px] text-muted-foreground">{t("branches.clients")}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("branches.editBranch") : t("branches.addBranch")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("branches.address")}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("branches.invoiceFooter")}</Label>
              <Textarea
                value={form.invoiceFooter}
                onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
                placeholder={t("branches.invoiceFooterPlaceholder")}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] shadow-md shadow-[oklch(0.72_0.17_75/0.15)] transition-all hover:shadow-lg hover:brightness-105">{editing ? t("common.update") : t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
