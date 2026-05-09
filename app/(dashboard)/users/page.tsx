"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";

interface Branch { id: string; name: string }

interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  branchId: string;
  createdAt: string;
  branch: { id: string; name: string };
}

export default function UsersPage() {
  const router = useRouter();
  const { isOwner, isLoading: roleLoading } = useRole();
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ email: "", name: "", phone: "", role: "EMPLOYEE" as "OWNER" | "EMPLOYEE", branchId: "", password: "" });

  useEffect(() => {
    if (!roleLoading && !isOwner) router.replace("/");
  }, [isOwner, roleLoading, router]);

  useEffect(() => {
    if (roleLoading || !isOwner) return;
    Promise.all([
      fetch("/api/users").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch("/api/branches").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    ])
      .then(([u, b]) => { setUsers(u); setBranches(b); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roleLoading, isOwner]);

  function refresh() {
    fetch("/api/users").then((r) => { if (!r.ok) return; return r.json(); }).then((d) => d && setUsers(d));
  }

  if (roleLoading || !isOwner) return null;
  if (loading) return <PageLoading />;

  function openCreate() {
    setEditing(null);
    setForm({ email: "", name: "", phone: "", role: "EMPLOYEE", branchId: branches[0]?.id ?? "", password: "" });
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ email: u.email, name: u.name, phone: u.phone || "", role: u.role as "OWNER" | "EMPLOYEE", branchId: u.branchId, password: "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      let res: Response;
      if (editing) {
        const data: Record<string, unknown> = { name: form.name, phone: form.phone || undefined, role: form.role, branchId: form.branchId };
        if (form.password) data.password = form.password;
        res = await fetch(`/api/users/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      } else {
        res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || t("users.failedSave"));
        return;
      }

      toast.success(editing ? t("users.updated") : t("users.created"));
      setDialogOpen(false);
      refresh();
    } catch {
      toast.error(t("common.networkError"));
    }
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`${t("users.deleteConfirm")} ${u.name}?`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || t("users.failedSave"));
        return;
      }
      toast.success(t("users.deleted"));
      refresh();
    } catch {
      toast.error(t("common.networkError"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} description={t("users.description")} action={{ label: t("users.addUser"), onClick: openCreate }} />

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title={t("users.noUsers")}
          description={t("users.noUsersDesc")}
          action={{ label: t("users.addUser"), onClick: openCreate }}
        />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id} className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl hover:shadow-md transition-all card-warm">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${u.role === "OWNER" ? "bg-[oklch(0.93_0.035_80)] dark:bg-[oklch(0.28_0.04_65)]" : "bg-muted/60"}`}>
                      <span className="text-sm font-bold">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{u.name}</p>
                        <Badge variant={u.role === "OWNER" ? "default" : "secondary"} className={`text-[10px] ${u.role === "OWNER" ? "bg-[oklch(0.72_0.17_75)] text-white" : ""}`}>
                          {u.role === "OWNER" ? t("role.owner") : t("role.employee")}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border/60">
                          {u.branch?.name ?? t("branches.noBranch")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteUser(u)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("common.edit") : t("users.addUser")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.name")}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{t("common.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editing} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("users.role")}</Label>
                <Select value={form.role} onValueChange={(v) => v && setForm({ ...form, role: v as "OWNER" | "EMPLOYEE" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">{t("role.owner")}</SelectItem>
                    <SelectItem value="EMPLOYEE">{t("role.employee")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("users.branch")}</Label>
              <Select value={form.branchId} onValueChange={(v) => v && setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder={t("users.selectBranch")} /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{editing ? t("users.newPassword") : t("users.password")}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} minLength={6} />
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
