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
  Receipt,
  Tag,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface ExpenseCategory {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  categoryId: string;
  category: ExpenseCategory;
}

export default function ExpensesPage() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [form, setForm] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    categoryId: "",
  });

  const router = useRouter();
  const { isEmployee } = useRole();

  useEffect(() => {
    if (isEmployee) router.replace("/orders");
  }, [isEmployee, router]);

  function loadCategories() {
    fetch("/api/expense-categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }

  function loadExpenses() {
    const params = new URLSearchParams();
    if (filterCategory && filterCategory !== "all")
      params.set("categoryId", filterCategory);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);

    fetch(`/api/expenses?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setExpenses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setExpenses([]);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [filterCategory, filterFrom, filterTo]);

  if (isEmployee) return null;

  function openCreate() {
    setEditing(null);
    setForm({
      amount: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      categoryId: "",
    });
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      amount: String(expense.amount),
      description: expense.description || "",
      date: expense.date.slice(0, 10),
      categoryId: expense.categoryId,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      amount: parseFloat(form.amount),
      description: form.description || undefined,
      date: form.date,
      categoryId: form.categoryId,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/expenses/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || t("expenses.failedSave"));
          return;
        }
        toast.success(t("expenses.updated"));
      } else {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || t("expenses.failedSave"));
          return;
        }
        toast.success(t("expenses.recorded"));
      }
      setDialogOpen(false);
      loadExpenses();
    } catch {
      toast.error(t("expenses.failedSave"));
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(t("expenses.failedDelete"));
        return;
      }
      toast.success(t("expenses.recorded"));
      loadExpenses();
    } catch {
      toast.error(t("expenses.failedDelete"));
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t("expenses.failedCreateCategory"));
        return;
      }
      toast.success(t("expenses.categoryAdded"));
      setNewCategoryName("");
      loadCategories();
    } catch {
      toast.error(t("expenses.failedCreateCategory"));
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      const res = await fetch(`/api/expense-categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t("expenses.failedDeleteCategory"));
        return;
      }
      toast.success(t("expenses.categoryDeleted"));
      loadCategories();
    } catch {
      toast.error(t("expenses.failedDeleteCategory"));
    }
  }

  function clearFilters() {
    setFilterCategory("all");
    setFilterFrom("");
    setFilterTo("");
  }

  const hasFilters =
    filterCategory !== "all" || filterFrom || filterTo;

  if (loading) return <PageLoading />;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("expenses.title")}
        description={t("expenses.description")}
        action={{ label: t("expenses.addExpense"), onClick: openCreate }}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("common.category")}</Label>
          <Select
            value={filterCategory}
            onValueChange={(v) => setFilterCategory(v ?? "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("expenses.allCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("common.from")}</Label>
          <Input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("common.to")}</Label>
          <Input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("common.clear")}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCategoryDialogOpen(true)}
          className="ml-auto"
        >
          <Tag className="mr-1.5 h-3.5 w-3.5" />
          {t("expenses.manageCategories")}
        </Button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("expenses.noExpenses")}
          description={t("expenses.noExpensesDesc")}
          action={{ label: t("expenses.addExpense"), onClick: openCreate }}
        />
      ) : (
        <>
          {/* Summary */}
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t("expenses.expenseCount").replace("{count}", String(expenses.length))}
            </span>
            <span className="text-lg font-bold">
              {formatCurrency(totalExpenses)}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/40 bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.category")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border/60">
                        {expense.category?.name ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {expense.description || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(expense)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create/Edit Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("expenses.editExpense") : t("expenses.addExpense")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("expenses.amount")}</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 50000"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.category")}</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) =>
                    v && setForm({ ...form, categoryId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("expenses.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("common.date")}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={t("common.optionalNotes")}
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

      {/* Category Management Dialog */}
      <Dialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("branchDetails.expenseCategories")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("expenses.newCategoryName")}
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              className="bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)]"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2"
              >
                <span className="text-sm">{c.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteCategory(c.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("expenses.noCategories")}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
