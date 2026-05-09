"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Clock, Package, ShoppingBag, Sparkles, Loader2, MapPin, Phone } from "lucide-react";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import type { OrderStatus } from "@/app/generated/prisma/enums";

interface TrackingItem {
  service: string;
  pricingType: string;
  quantity: number;
  weightKg: number | null;
}

interface TrackingData {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatusLabel: string;
  customerName: string;
  createdAt: string;
  receivedAt: string | null;
  inProgressAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  items: TrackingItem[];
  branch: { name: string; phone: string | null; address: string | null };
}

const STEPS: { key: OrderStatus; labelKey: string; icon: typeof ShoppingBag }[] = [
  { key: "RECEIVED", labelKey: "status.received", icon: ShoppingBag },
  { key: "IN_PROGRESS", labelKey: "status.inProgress", icon: Sparkles },
  { key: "READY", labelKey: "status.ready", icon: Package },
  { key: "DELIVERED", labelKey: "status.delivered", icon: CheckCircle },
];

function getTimestamp(data: TrackingData, status: OrderStatus): string | null {
  switch (status) {
    case "RECEIVED": return data.receivedAt || data.createdAt;
    case "IN_PROGRESS": return data.inProgressAt;
    case "READY": return data.readyAt;
    case "DELIVERED": return data.deliveredAt;
    default: return null;
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StepIcon({ step, isComplete, isCurrent }: { step: typeof STEPS[number]; isComplete: boolean; isCurrent: boolean }) {
  const Icon = step.icon;
  if (isComplete) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] text-white shadow-md shadow-[oklch(0.72_0.17_75/0.3)]">
        <CheckCircle className="h-5 w-5" />
      </div>
    );
  }
  if (isCurrent) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] text-white shadow-md shadow-[oklch(0.72_0.17_75/0.3)] animate-amber-glow">
        <Icon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
      <Icon className="h-5 w-5" />
    </div>
  );
}

export default function TrackOrderPage() {
  const params = useParams();
  const orderNumber = params.orderNumber as string;
  const { t } = useTranslation();
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/track/${orderNumber}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? t("tracking.orderNotFoundShort") : t("tracking.failedToLoad"));
        return r.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [orderNumber, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
            <Package className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">{t("tracking.orderNotFound")}</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.72_0.17_75)]" />
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === data.status);

  return (
    <div className="mx-auto max-w-md min-h-screen pb-8">
      {/* Header with warm honey amber gradient */}
      <div className="bg-gradient-to-br from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] p-6 pb-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.branch.name}</h1>
            <p className="text-sm opacity-80">{t("tracking.orderTracking")}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
          <p className="text-xs opacity-70 mb-1">{t("tracking.orderNumber")}</p>
          <p className="text-2xl font-bold tracking-wide">{data.orderNumber}</p>
          <p className="text-sm mt-1 opacity-80">{t("tracking.hi").replace("{name}", data.customerName)}</p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Status Timeline Card */}
        <div className="rounded-xl border-0 bg-white/90 dark:bg-[oklch(0.195_0.025_55/0.8)] p-5 shadow-lg shadow-[oklch(0.72_0.17_75/0.08)]">
          <h2 className="font-semibold mb-5 text-sm text-muted-foreground uppercase tracking-wider">{t("tracking.orderProgress")}</h2>
          <div className="space-y-0">
            {STEPS.map((step, idx) => {
              const isComplete = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const timestamp = getTimestamp(data, step.key);
              const isLast = idx === STEPS.length - 1;

              return (
                <div key={step.key} className="flex gap-4">
                  {/* Timeline line + icon */}
                  <div className="flex flex-col items-center">
                    <StepIcon step={step} isComplete={isComplete} isCurrent={isCurrent} />
                    {!isLast && (
                      <div className={`w-0.5 h-10 ${idx < currentIdx ? "bg-gradient-to-b from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)]" : "bg-border"}`} />
                    )}
                  </div>
                  {/* Content */}
                  <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                    <p className={`font-medium text-sm ${isCurrent ? "text-[oklch(0.72_0.17_75)]" : isComplete ? "text-[oklch(0.62_0.14_55)] dark:text-[oklch(0.78_0.18_75)]" : "text-muted-foreground"}`}>
                      {t(step.labelKey)}
                    </p>
                    {timestamp && (
                      <p className="text-xs text-muted-foreground mt-0.5">{formatTime(timestamp)}</p>
                    )}
                    {isCurrent && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1.5 ${ORDER_STATUS_CONFIG[data.status]?.color ?? "bg-muted text-muted-foreground"}`}>
                        {t(data.statusLabel)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Items Card */}
        <div className="rounded-xl border-0 bg-white/90 dark:bg-[oklch(0.195_0.025_55/0.8)] p-5 shadow-lg shadow-[oklch(0.72_0.17_75/0.08)]">
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">{t("tracking.services")}</h2>
          <div className="space-y-2">
            {data.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[oklch(0.97_0.008_85)] dark:bg-[oklch(0.26_0.025_55)] px-3 py-2.5">
                <span className="font-medium text-sm">{item.service}</span>
                <span className="text-sm text-muted-foreground">
                  {item.pricingType === "PER_KG" && item.weightKg ? `${item.weightKg} kg` : `${item.quantity}x`}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("common.payment")}</span>
            <span className="font-medium">{t(data.paymentStatusLabel)}</span>
          </div>
        </div>

        {/* Branch Info Card */}
        <div className="rounded-xl border-0 bg-white/90 dark:bg-[oklch(0.195_0.025_55/0.8)] p-5 shadow-lg shadow-[oklch(0.72_0.17_75/0.08)]">
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">{t("tracking.location")}</h2>
          {data.branch.address && (
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="h-4 w-4 text-[oklch(0.72_0.17_75)] mt-0.5 shrink-0" />
              <p className="text-sm">{data.branch.address}</p>
            </div>
          )}
          {data.branch.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[oklch(0.72_0.17_75)] shrink-0" />
              <a href={`tel:${data.branch.phone}`} className="text-sm text-[oklch(0.72_0.17_75)] hover:underline">{data.branch.phone}</a>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-2">
          {t("tracking.createdOn")} {new Date(data.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
