"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { Plus, Pencil, Trash2, Weight, Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { PRICING_TYPE_LABELS, COMMISSION_TYPE_LABELS } from "@/lib/constants";

interface Service {
  id: string;
  name: string;
  description: string | null;
  pricingType: "PER_KG" | "PER_ITEM";
  basePrice: number;
  commissionType: "NONE" | "FLAT" | "PERCENTAGE";
  commissionValue: number;
  isActive: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", description: "", pricingType: "PER_KG" as "PER_KG" | "PER_ITEM", basePrice: "", commissionType: "NONE" as "NONE" | "FLAT" | "PERCENTAGE", commissionValue: "" });

  const router = useRouter();
  const { isEmployee } = useRole();
  const { t } = useTranslation();

  useEffect(() => {
    if (isEmployee) router.replace("/orders");
  }, [isEmployee, router]);

  function loadServices() {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadServices(); }, []);

  if (isEmployee) return null;

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", pricingType: "PER_KG", basePrice: "", commissionType: "NONE", commissionValue: "" });
    setDialogOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || "",
      pricingType: s.pricingType,
      basePrice: String(s.basePrice),
      commissionType: s.commissionType,
      commissionValue: s.commissionValue ? String(s.commissionValue) : "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      description: form.description || undefined,
      pricingType: form.pricingType,
      basePrice: parseFloat(form.basePrice),
      commissionType: form.commissionType,
      commissionValue: form.commissionType !== "NONE" && form.commissionValue ? parseFloat(form.commissionValue) : 0,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/services/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || t("services.failedUpdate"));
          return;
        }
        toast.success(t("services.updated"));
      } else {
        const res = await fetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || t("services.failedSave"));
          return;
        }
        toast.success(t("services.created"));
      }
      setDialogOpen(false);
      loadServices();
    } catch {
      toast.error(t("services.failedSave"));
    }
  }

  async function toggleActive(s: Service) {
    try {
      const res = await fetch(`/api/services/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !s.isActive }) });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t("services.failedUpdate"));
        return;
      }
      toast.success(s.isActive ? t("services.deactivated") : t("services.activated"));
      loadServices();
    } catch {
      toast.error(t("services.failedUpdate"));
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("services.title")} description={t("services.description")} action={{ label: t("services.addService"), onClick: openCreate }} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Card key={s.id} className={`border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl hover:shadow-md transition-all ${!s.isActive ? "opacity-60" : ""}`}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  s.pricingType === "PER_KG"
                    ? "bg-[oklch(0.93_0.035_80)] dark:bg-[oklch(0.28_0.04_65)]"
                    : "bg-[oklch(0.95_0.02_85)] dark:bg-[oklch(0.26_0.025_55)]"
                }`}>
                  {s.pricingType === "PER_KG" ? (
                    <Weight className="h-4 w-4 text-[oklch(0.72_0.17_75)]" />
                  ) : (
                    <Package className="h-4 w-4 text-[oklch(0.68_0.12_40)]" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(s)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold">{formatCurrency(s.basePrice)}</span>
                <div className="flex gap-1.5">
                  {s.commissionType !== "NONE" && (
                    <Badge variant="outline" className="border-border/60">
                      {s.commissionType === "FLAT"
                        ? `${t("services.commBadge")}: ${formatCurrency(s.commissionValue)}`
                        : `${t("services.commBadge")}: ${s.commissionValue}%`}
                    </Badge>
                  )}
                  <Badge variant={s.isActive ? "default" : "secondary"} className={s.isActive ? "bg-[oklch(0.72_0.17_75)] text-white" : ""}>
                    {t(PRICING_TYPE_LABELS[s.pricingType])}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("services.editService") : t("services.addService")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("services.pricingType")}</Label>
                <Select value={form.pricingType} onValueChange={(v) => v && setForm({ ...form, pricingType: v as "PER_KG" | "PER_ITEM" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_KG">{t("pricingType.perKg")}</SelectItem>
                    <SelectItem value="PER_ITEM">{t("pricingType.perItem")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("services.price")}</Label>
                <Input type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("services.commissionType")}</Label>
                <Select value={form.commissionType} onValueChange={(v) => v && setForm({ ...form, commissionType: v as "NONE" | "FLAT" | "PERCENTAGE", commissionValue: v === "NONE" ? "" : form.commissionValue })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t("commissionType.none")}</SelectItem>
                    <SelectItem value="FLAT">{t("commissionType.flat")}</SelectItem>
                    <SelectItem value="PERCENTAGE">{t("commissionType.percentage")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.commissionType !== "NONE" && (
                <div className="space-y-2">
                  <Label>{form.commissionType === "FLAT" ? t("services.commissionRp") : t("services.commissionPercent")}</Label>
                  <Input type="number" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} placeholder={form.commissionType === "FLAT" ? t("services.placeholderFlat") : t("services.placeholderPercent")} required />
                </div>
              )}
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
