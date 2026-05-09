"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, X, Loader2, Search, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { PageLoading } from "@/components/shared/loading";
import { PRICING_TYPE_LABELS } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";

interface Service {
  id: string;
  name: string;
  pricingType: "PER_KG" | "PER_ITEM";
  basePrice: number;
  isActive: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface LineItem {
  serviceId: string;
  quantity: string;
  weightKg: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [custSearch, setCustSearch] = useState("");
  const [showCustResults, setShowCustResults] = useState(false);
  const [showNewCust, setShowNewCust] = useState(false);
  const [custForm, setCustForm] = useState({ name: "", phone: "" });

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-customer-search]")) {
        setShowCustResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Items
  const [items, setItems] = useState<LineItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");

  // Discount
  const [discountMode, setDiscountMode] = useState<"none" | "percentage" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
    ]).then(([svcs, custs]) => {
      setServices(svcs.filter((s: Service) => s.isActive));
      setCustomers(custs);
      setLoading(false);
    });
  }, []);

  function getService(id: string) {
    return services.find((s) => s.id === id);
  }

  function calcSubtotal(item: LineItem) {
    const svc = getService(item.serviceId);
    if (!svc) return 0;
    return svc.pricingType === "PER_KG"
      ? svc.basePrice * (parseFloat(item.weightKg) || 0)
      : svc.basePrice * (parseFloat(item.quantity) || 0);
  }

  const subtotal = items.reduce((sum, i) => sum + calcSubtotal(i), 0);

  // Discount calculation
  let discountCalculated = 0;
  if (discountMode === "percentage") {
    const pct = parseFloat(discountValue) || 0;
    discountCalculated = subtotal * Math.min(pct, 100) / 100;
  } else if (discountMode === "fixed") {
    const fixed = parseFloat(discountValue) || 0;
    discountCalculated = Math.min(fixed, subtotal);
  }

  const total = subtotal - discountCalculated;

  const filteredCustomers = custSearch
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
          c.phone.includes(custSearch)
      )
    : customers;

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustSearch("");
    setShowCustResults(false);
  }

  function addServiceItem(serviceId: string) {
    const svc = getService(serviceId);
    if (!svc) return;
    setItems([
      ...items,
      {
        serviceId,
        quantity: "1",
        weightKg: svc.pricingType === "PER_KG" ? "" : "",
      },
    ]);
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(custForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error);
        return;
      }
      const customer = await res.json();
      setCustomers([...customers, customer]);
      setSelectedCustomer(customer);
      setShowNewCust(false);
      setCustForm({ name: "", phone: "" });
      toast.success(t("newOrder.customerCreated"));
    } catch {
      toast.error(t("newOrder.failedCreateCustomer"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) { toast.error(t("orders.selectCustomer")); return; }
    if (items.length === 0) { toast.error(t("orders.addItem")); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          notes: orderNotes || undefined,
          items: items.map((i) => ({
            serviceId: i.serviceId,
            quantity: parseFloat(i.quantity),
            weightKg: i.weightKg ? parseFloat(i.weightKg) : undefined,
          })),
          discountType: discountMode === "none" ? undefined : discountMode === "percentage" ? "PERCENTAGE" : "FIXED",
          discountAmount: discountMode === "none" ? undefined : parseFloat(discountValue) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error);
        return;
      }
      const order = await res.json();
      toast.success(t("orders.orderCreated"));
      router.push(`/orders/${order.id}`);
    } catch {
      toast.error(t("newOrder.failedCreate"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight font-semibold">{t("newOrder.title")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer */}
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl overflow-visible">
          <CardHeader><CardTitle className="text-base font-semibold">{t("common.customer")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3">
                <div>
                  <span className="font-medium">{selectedCustomer.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{selectedCustomer.phone}</span>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCustomer(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative" data-customer-search>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-muted/30 border-border/60"
                    placeholder={t("newOrder.searchPlaceholder")}
                    value={custSearch}
                    onChange={(e) => {
                      setCustSearch(e.target.value);
                      setShowCustResults(true);
                    }}
                    onFocus={() => setShowCustResults(true)}
                  />
                  {showCustResults && filteredCustomers.length > 0 && (
                    <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border/40 bg-popover shadow-md max-h-48 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-accent/60 transition-colors"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectCustomer(c)}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showCustResults && custSearch && filteredCustomers.length === 0 && (
                    <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border/40 bg-popover shadow-md p-3">
                      <p className="text-sm text-muted-foreground mb-2">{t("newOrder.noCustomerFound")}</p>
                      <Button type="button" variant="outline" size="sm" className="w-full rounded-lg" onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowCustResults(false); setShowNewCust(true); }}>
                        <Plus className="mr-1 h-3 w-3" /> {t("newOrder.newCustomer")}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setShowNewCust(!showNewCust)}>
                    <Plus className="mr-1 h-3 w-3" /> {t("newOrder.newCustomer")}
                  </Button>
                </div>
                {showNewCust && (
                  <div className="rounded-xl border border-border/40 p-4 space-y-3 bg-muted/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t("common.name")}</Label>
                        <Input
                          placeholder={t("newOrder.namePlaceholder")}
                          value={custForm.name}
                          onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                          className="bg-muted/30 border-border/60"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("common.phone")}</Label>
                        <Input
                          placeholder={t("newOrder.phonePlaceholder")}
                          value={custForm.phone}
                          onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                          className="bg-muted/30 border-border/60"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" className="rounded-lg" onClick={handleCreateCustomer} disabled={!custForm.name || !custForm.phone}>
                        {t("newOrder.createAndSelect")}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setShowNewCust(false)}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Service Cards */}
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardHeader><CardTitle className="text-base font-semibold">{t("newOrder.addServices")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                    s.pricingType === "PER_KG"
                      ? "border-amber-200/60 hover:border-amber-400 hover:bg-amber-50/50"
                      : "border-orange-200/60 hover:border-orange-400 hover:bg-orange-50/50"
                  }`}
                  onClick={() => addServiceItem(s.id)}
                >
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="text-lg font-bold mt-1">{formatCurrency(s.basePrice)}</span>
                  <Badge variant="secondary" className={`mt-1 text-[10px] rounded-full ${
                    s.pricingType === "PER_KG"
                      ? "bg-amber-100/80 text-amber-700 hover:bg-amber-100/80"
                      : "bg-orange-100/80 text-orange-700 hover:bg-orange-100/80"
                  }`}>
                    /{t(PRICING_TYPE_LABELS[s.pricingType])}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        {items.length > 0 && (
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardHeader><CardTitle className="text-base font-semibold">{t("newOrder.orderItems")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, idx) => {
                const svc = getService(item.serviceId);
                if (!svc) return null;
                return (
                  <div key={idx} className="flex items-start sm:items-center gap-3 rounded-xl border border-border/40 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{svc.name}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        {svc.pricingType === "PER_KG" ? (
                          <>
                            <button
                              type="button"
                              className="h-7 w-7 rounded-lg border border-border/40 flex items-center justify-center hover:bg-accent/60 transition-colors"
                              onClick={() => {
                                const val = Math.max(0, (parseFloat(item.weightKg) || 0) - 0.5);
                                updateItem(idx, "weightKg", val > 0 ? val.toFixed(1) : "");
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              step="0.1"
                              className="w-16 rounded-lg border border-border/40 px-2 py-1 text-sm text-center bg-transparent font-medium"
                              value={item.weightKg}
                              onChange={(e) => updateItem(idx, "weightKg", e.target.value)}
                              placeholder="0.0"
                              autoFocus
                            />
                            <button
                              type="button"
                              className="h-7 w-7 rounded-lg border border-border/40 flex items-center justify-center hover:bg-accent/60 transition-colors"
                              onClick={() => {
                                const val = (parseFloat(item.weightKg) || 0) + 0.5;
                                updateItem(idx, "weightKg", val.toFixed(1));
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <span className="text-xs text-muted-foreground ml-1">{t("newOrder.kg")}</span>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="h-7 w-7 rounded-lg border border-border/40 flex items-center justify-center hover:bg-accent/60 transition-colors"
                              onClick={() => {
                                const val = Math.max(1, (parseInt(item.quantity) || 1) - 1);
                                updateItem(idx, "quantity", String(val));
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              className="w-14 rounded-lg border border-border/40 px-2 py-1 text-sm text-center bg-transparent font-medium"
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                            />
                            <button
                              type="button"
                              className="h-7 w-7 rounded-lg border border-border/40 flex items-center justify-center hover:bg-accent/60 transition-colors"
                              onClick={() => {
                                const val = (parseInt(item.quantity) || 0) + 1;
                                updateItem(idx, "quantity", String(val));
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <span className="text-xs text-muted-foreground ml-1">{t("orders.items")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-sm whitespace-nowrap">
                      {formatCurrency(calcSubtotal(item))}
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-lg" onClick={() => removeItem(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
              <Separator />
              <div className="flex justify-between items-center px-1">
                <span className="text-muted-foreground">{items.length} {t("orders.items")}</span>
                <span className="text-xl font-bold">{formatCurrency(subtotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Discount */}
        {items.length > 0 && (
          <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
            <CardHeader><CardTitle className="text-base font-semibold">{t("newOrder.discount")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    discountMode === "none"
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/40 hover:bg-accent/60"
                  }`}
                  onClick={() => { setDiscountMode("none"); setDiscountValue(""); }}
                >
                  {t("newOrder.noDiscount")}
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    discountMode === "percentage"
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/40 hover:bg-accent/60"
                  }`}
                  onClick={() => { setDiscountMode("percentage"); setDiscountValue(""); }}
                >
                  {t("newOrder.percentage")}
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    discountMode === "fixed"
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/40 hover:bg-accent/60"
                  }`}
                  onClick={() => { setDiscountMode("fixed"); setDiscountValue(""); }}
                >
                  {t("newOrder.fixedAmount")}
                </button>
              </div>
              {discountMode === "percentage" && (
                <div className="space-y-1">
                  <Label className="text-xs">{t("newOrder.discountPercentage")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="max-w-full sm:max-w-[120px] bg-muted/30 border-border/60 rounded-lg"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              )}
              {discountMode === "fixed" && (
                <div className="space-y-1">
                  <Label className="text-xs">{t("newOrder.discountAmount")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rp</span>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="max-w-full sm:max-w-[200px] bg-muted/30 border-border/60 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes & Submit */}
        <Card className="border-0 shadow-none bg-white/80 dark:bg-[oklch(0.195_0.025_55/0.6)] rounded-xl">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t("common.notes")}</Label>
              <Textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder={t("newOrder.anyNotes")} className="bg-muted/30 border-border/60 rounded-xl" />
            </div>

            {/* Price breakdown */}
            {items.length > 0 && (
              <div className="space-y-2 rounded-xl border border-primary/10 bg-primary/5 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("orderDetails.subtotal")}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountCalculated > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("orderDetails.discount")}
                      {discountMode === "percentage" && discountValue ? ` (${discountValue}%)` : ""}
                      {discountMode === "fixed" ? ` ${t("orderDetails.fixed")}` : ""}
                    </span>
                    <span className="text-red-600">-{formatCurrency(discountCalculated)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-medium">{t("common.total")}</span>
                  <span className="font-bold">{formatCurrency(total)}</span>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] shadow-md shadow-[oklch(0.72_0.17_75/0.15)] hover:shadow-lg hover:shadow-[oklch(0.72_0.17_75/0.2)] transition-shadow" size="lg" disabled={submitting || !selectedCustomer || items.length === 0}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("orders.createOrder")} — {formatCurrency(total)}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
