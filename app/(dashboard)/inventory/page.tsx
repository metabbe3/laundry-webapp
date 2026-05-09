"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  ArrowUpDown,
  History,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";

interface StockItem {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  purchasePricePerUnit: number;
  isActive: boolean;
}

interface StockMovement {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  notes: string | null;
  date: string;
  createdAt: string;
}

export default function InventoryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [form, setForm] = useState({
    name: "",
    unit: "",
    initialQuantity: "",
    lowStockThreshold: "",
    purchasePricePerUnit: "",
  });
  const [movementForm, setMovementForm] = useState({
    type: "IN" as "IN" | "OUT",
    quantity: "",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const router = useRouter();
  const { isEmployee } = useRole();

  useEffect(() => {
    if (isEmployee) router.replace("/orders");
  }, [isEmployee, router]);

  function loadItems() {
    fetch("/api/stock-items")
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadItems();
  }, []);

  if (isEmployee) return null;

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      unit: "",
      initialQuantity: "",
      lowStockThreshold: "",
      purchasePricePerUnit: "",
    });
    setDialogOpen(true);
  }

  function openEdit(item: StockItem) {
    setEditing(item);
    setForm({
      name: item.name,
      unit: item.unit,
      initialQuantity: String(item.currentQuantity),
      lowStockThreshold: String(item.lowStockThreshold),
      purchasePricePerUnit: String(item.purchasePricePerUnit),
    });
    setDialogOpen(true);
  }

  function openMovement(item: StockItem) {
    setSelectedItem(item);
    setMovementForm({
      type: "IN",
      quantity: "",
      notes: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setMovementDialogOpen(true);
  }

  async function openHistory(item: StockItem) {
    setSelectedItem(item);
    const res = await fetch(`/api/stock-items/${item.id}/movements`);
    const data = await res.json();
    setMovements(data);
    setHistoryDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      unit: form.unit,
      currentQuantity: editing ? undefined : (parseFloat(form.initialQuantity) || 0),
      lowStockThreshold: parseFloat(form.lowStockThreshold) || 0,
      purchasePricePerUnit: parseFloat(form.purchasePricePerUnit) || 0,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/stock-items/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || t("inventory.failedUpdate"));
          return;
        }
        toast.success(t("inventory.updated"));
      } else {
        const res = await fetch("/api/stock-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || t("inventory.failedSave"));
          return;
        }
        toast.success(t("inventory.created"));
      }
      setDialogOpen(false);
      loadItems();
    } catch {
      toast.error(t("inventory.failedSave"));
    }
  }

  async function handleMovementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const res = await fetch(`/api/stock-items/${selectedItem.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementForm.type,
          quantity: parseFloat(movementForm.quantity),
          notes: movementForm.notes || undefined,
          date: movementForm.date,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t("inventory.failedRecordMovement"));
        return;
      }
      toast.success(
        movementForm.type === "IN" ? t("inventory.stockAdded") : t("inventory.stockRemoved")
      );
      setMovementDialogOpen(false);
      loadItems();
    } catch {
      toast.error(t("inventory.failedRecordMovement"));
    }
  }

  async function toggleActive(item: StockItem) {
    try {
      const res = await fetch(`/api/stock-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t("inventory.failedUpdate"));
        return;
      }
      toast.success(item.isActive ? t("inventory.deactivated") : t("inventory.activated"));
      loadItems();
    } catch {
      toast.error(t("inventory.failedUpdate"));
    }
  }

  if (loading) return <PageLoading />;

  const activeItems = items.filter((i) => i.isActive);
  const lowStockItems = activeItems.filter(
    (i) => i.currentQuantity <= i.lowStockThreshold
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.description")}
        action={{ label: t("inventory.addItem"), onClick: openCreate }}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("inventory.noStockItems")}
          description={t("inventory.noStockItemsDesc")}
          action={{ label: t("inventory.addItem"), onClick: openCreate }}
        />
      ) : (
        <>
          {lowStockItems.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/20 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                {t("inventory.lowStockAlert").replace("{count}", String(lowStockItems.length))}
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isLow =
                item.isActive && item.currentQuantity <= item.lowStockThreshold;
              return (
                <Card
                  key={item.id}
                  className={`border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl hover:shadow-md transition-all ${
                    !item.isActive ? "opacity-60" : ""
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isLow
                            ? "bg-red-50 dark:bg-red-900/30"
                            : "bg-teal-50 dark:bg-teal-900/30"
                        }`}
                      >
                        <Package
                          className={`h-4 w-4 ${
                            isLow
                              ? "text-red-500"
                              : "text-teal-600 dark:text-teal-400"
                          }`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.unit}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openMovement(item)}
                        title={t("inventory.recordMovement")}
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openHistory(item)}
                        title={t("inventory.movementHistory").split(" — ")[0]}
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActive(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold">
                          {item.currentQuantity}
                        </span>
                        <span className="text-sm text-muted-foreground ml-1">
                          {item.unit}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.purchasePricePerUnit)}/{item.unit}
                        </span>
                        {isLow && (
                          <Badge className="bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                            {t("inventory.lowStock")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("inventory.editItem") : t("inventory.addItem")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Detergent, Sabun, Softener"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!editing && (
                <div className="space-y-2">
                  <Label>{t("inventory.initialQuantity")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.initialQuantity}
                    onChange={(e) =>
                      setForm({ ...form, initialQuantity: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("common.unit")}</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="e.g. kg, liter, pcs"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("inventory.lowStockThreshold")}</Label>
                <Input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(e) =>
                    setForm({ ...form, lowStockThreshold: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("inventory.purchasePricePerUnit")}</Label>
              <Input
                type="number"
                value={form.purchasePricePerUnit}
                onChange={(e) =>
                  setForm({ ...form, purchasePricePerUnit: e.target.value })
                }
                placeholder="0"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] shadow-md shadow-[oklch(0.72_0.17_75/0.15)] transition-all hover:shadow-lg hover:brightness-105"
              >
                {editing ? t("common.update") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("inventory.stockMovement").replace("{name}", selectedItem?.name ?? "")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovementSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select
                value={movementForm.type}
                onValueChange={(v) =>
                  v &&
                  setMovementForm({
                    ...movementForm,
                    type: v as "IN" | "OUT",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">{t("inventory.stockIn")}</SelectItem>
                  <SelectItem value="OUT">{t("inventory.stockOut")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.quantity")} ({selectedItem?.unit})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={movementForm.quantity}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      quantity: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.date")}</Label>
                <Input
                  type="date"
                  value={movementForm.date}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, date: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.notes")}</Label>
              <Textarea
                value={movementForm.notes}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, notes: e.target.value })
                }
                placeholder={t("common.optionalNotes")}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] shadow-md shadow-[oklch(0.72_0.17_75/0.15)] transition-all hover:shadow-lg hover:brightness-105"
              >
                {t("inventory.recordMovement")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movement History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("inventory.movementHistory").replace("{name}", selectedItem?.name ?? "")}
            </DialogTitle>
          </DialogHeader>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("inventory.noMovements")}
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        m.type === "IN"
                          ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                      }
                    >
                      {m.type === "IN" ? t("inventory.typeIn") : t("inventory.typeOut")}
                    </Badge>
                    <div>
                      <span className="text-sm font-medium">
                        {m.quantity} {selectedItem?.unit}
                      </span>
                      {m.notes && (
                        <p className="text-xs text-muted-foreground">
                          {m.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(m.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
