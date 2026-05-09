"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Search, Plus, Pencil, Phone, Mail, ArrowUpDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { formatCurrency, formatDate } from "@/lib/format";
import { CUSTOMER_STATUS_CONFIG } from "@/lib/constants";
import type { CustomerStatus } from "@/lib/constants";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  customerStatus: CustomerStatus;
}

export default function CustomersPage() {
  const { isEmployee } = useRole();
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("customers.sortNewest") },
    { value: "name", label: t("customers.sortName") },
    { value: "orderCount", label: t("customers.sortOrders") },
    { value: "totalSpent", label: t("customers.sortSpent") },
    { value: "lastOrderDate", label: t("customers.sortLastOrder") },
  ];
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (sortBy) params.set("sort", sortBy);
    if (sortOrder) params.set("order", sortOrder);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/customers?${params}`)
      .then((r) => r.json())
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, [search, sortBy, sortOrder, statusFilter]);

  function refresh() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (sortBy) params.set("sort", sortBy);
    if (sortOrder) params.set("order", sortOrder);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/customers?${params}`)
      .then((r) => r.json())
      .then(setCustomers);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(c: Customer, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, email: c.email || "", notes: c.notes || "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name: form.name, phone: form.phone, email: form.email || undefined, notes: form.notes || undefined };

    try {
      const res = editing
        ? await fetch(`/api/customers/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        : await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error);
        return;
      }

      toast.success(editing ? t("customers.updated") : t("customers.created"));
      setDialogOpen(false);
      refresh();
    } catch {
      toast.error(t("customers.failedSave"));
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("customers.title")} description={t("customers.description")} action={{ label: t("customers.addCustomer"), onClick: openCreate }} />

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-muted/30 border border-border/60 rounded-xl p-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("customers.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <select
          value={statusFilter || "ALL"}
          onChange={(e) => setStatusFilter(e.target.value === "ALL" ? "" : e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 appearance-none cursor-pointer"
        >
          <option value="ALL">{t("customers.allStatuses")}</option>
          <option value="ACTIVE">{t("status.active")}</option>
          <option value="AT_RISK">{t("status.atRisk")}</option>
          <option value="LAPSED">{t("status.lapsed")}</option>
          <option value="NEW">{t("status.new")}</option>
        </select>

        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 appearance-none cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <Button variant="outline" size="icon" onClick={() => setSortOrder((prev) => prev === "asc" ? "desc" : "asc")} title={sortOrder === "asc" ? t("customers.ascending") : t("customers.descending")}>
          <ArrowUpDown className={`h-4 w-4 ${sortOrder === "desc" ? "rotate-180" : ""} transition-transform`} />
        </Button>
      </div>

      {customers.length === 0 ? (
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            {search || statusFilter ? t("customers.noCustomersFilter") : t("customers.noCustomers")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => {
            const statusCfg = CUSTOMER_STATUS_CONFIG[c.customerStatus];
            const card = (
              <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl hover:shadow-md hover:bg-white dark:hover:bg-[oklch(0.195_0.025_55/0.8)] transition-all cursor-pointer card-warm">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{c.name}</p>
                        <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${statusCfg.color}`}>
                          {t(statusCfg.labelKey)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" /> {c.email}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => openEdit(c, e)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {c.notes && <p className="text-xs text-muted-foreground truncate">{c.notes}</p>}
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                    <div className="text-center">
                      <p className="text-lg font-bold">{c.totalOrders}</p>
                      <p className="text-[10px] text-muted-foreground">{t("common.orders")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold">{c.totalSpent > 0 ? formatCurrency(c.totalSpent) : "---"}</p>
                      <p className="text-[10px] text-muted-foreground">{t("customers.sortSpent")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{c.lastOrderDate ? formatDate(c.lastOrderDate) : "---"}</p>
                      <p className="text-[10px] text-muted-foreground">{t("customers.lastOrder")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            return isEmployee ? (
              <div key={c.id}>{card}</div>
            ) : (
              <Link key={c.id} href={`/customers/${c.id}`}>
                {card}
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("customers.editCustomer") : t("customers.addCustomer")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
