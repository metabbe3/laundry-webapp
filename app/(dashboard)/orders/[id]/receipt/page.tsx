"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, BUSINESS_NAME_KEY, BUSINESS_TAGLINE_KEY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "@/hooks/use-translation";

interface OrderItem {
  id: string;
  quantity: number;
  weightKg: number | null;
  pricePerUnit: number;
  subtotal: number;
  service: { name: string; pricingType: string };
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
}

interface OrderReceipt {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  paidAmount: number;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  customer: { name: string; phone: string };
  orderItems: OrderItem[];
  payments: Payment[];
  branch: { name: string; address: string | null; phone: string | null; invoiceFooter: string | null };
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderReceipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/orders/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load order");
          return r.json();
        })
        .then((data) => {
          setOrder({
            ...data,
            discountAmount: Number(data.discountAmount ?? 0),
            discountType: data.discountType ?? null,
          });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return <p className="text-center py-12 text-muted-foreground">{t("receipt.failedLoad")}</p>;
  }

  const remaining = order.totalAmount - order.paidAmount;
  const latestPayment = order.payments[0];
  const trackingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/track/${order.orderNumber}`;

  return (
    <div className="max-w-md mx-auto">
      {/* Action buttons - hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">{t("receipt.title")}</h1>
        <Button className="ml-auto" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" />
          {t("receipt.print")}
        </Button>
      </div>

      {/* Receipt body */}
      <div className="receipt-thermal border rounded-lg p-6 print:border-none print:p-0">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">{order.branch.name ?? t(BUSINESS_NAME_KEY)}</h2>
          <p className="text-sm text-muted-foreground">{t(BUSINESS_TAGLINE_KEY)}</p>
          {order.branch.address && (
            <p className="text-xs text-muted-foreground mt-0.5">{order.branch.address}</p>
          )}
          {order.branch.phone && (
            <p className="text-xs text-muted-foreground">{order.branch.phone}</p>
          )}
        </div>

        <hr className="border-dashed my-3" />

        {/* Order info */}
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-0.5 text-muted-foreground">{t("receipt.order")}</td>
              <td className="py-0.5 text-right font-medium">{order.orderNumber}</td>
            </tr>
            <tr>
              <td className="py-0.5 text-muted-foreground">{t("common.date")}</td>
              <td className="py-0.5 text-right">{formatDate(order.createdAt)}</td>
            </tr>
            <tr>
              <td className="py-0.5 text-muted-foreground">{t("common.status")}</td>
              <td className="py-0.5 text-right font-medium">{order.status.replace("_", " ")}</td>
            </tr>
          </tbody>
        </table>

        <hr className="border-dashed my-3" />

        {/* Customer */}
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-0.5 text-muted-foreground">{t("receipt.customer")}</td>
              <td className="py-0.5 text-right font-medium">{order.customer.name}</td>
            </tr>
            <tr>
              <td className="py-0.5 text-muted-foreground">{t("common.phone")}</td>
              <td className="py-0.5 text-right">{order.customer.phone}</td>
            </tr>
          </tbody>
        </table>

        <hr className="border-dashed my-3" />

        {/* Items table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-left font-medium">{t("receipt.service")}</th>
              <th className="py-1 text-right font-medium">{t("receipt.qty")}</th>
              <th className="py-1 text-right font-medium">{t("common.price")}</th>
              <th className="py-1 text-right font-medium">{t("receipt.subtotal")}</th>
            </tr>
          </thead>
          <tbody>
            {order.orderItems.map((item) => (
              <tr key={item.id} className="border-b border-dashed">
                <td className="py-1.5">{item.service.name}</td>
                <td className="py-1.5 text-right">
                  {item.service.pricingType === "PER_KG"
                    ? `${item.weightKg} ${t("newOrder.kg")}`
                    : `${item.quantity}x`}
                </td>
                <td className="py-1.5 text-right">{formatCurrency(item.pricePerUnit)}</td>
                <td className="py-1.5 text-right">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-3 space-y-1 text-sm">
          {order.discountAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.discount")}</span>
              <span>-{formatCurrency(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-1">
            <span>{t("common.total")}</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receipt.paid")}</span>
            <span className="text-green-600">{formatCurrency(order.paidAmount)}</span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.remaining")}</span>
              <span className="text-red-600 font-medium">{formatCurrency(remaining)}</span>
            </div>
          )}
        </div>

        {/* Payment method */}
        {latestPayment && (
          <>
            <hr className="border-dashed my-3" />
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-0.5 text-muted-foreground">{t("receipt.paymentMethod")}</td>
                  <td className="py-0.5 text-right font-medium">
                    {t(PAYMENT_METHOD_LABELS[latestPayment.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS])}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Notes */}
        {order.notes && (
          <>
            <hr className="border-dashed my-3" />
            <div className="text-sm">
              <span className="text-muted-foreground">{t("receipt.notes")}: </span>
              <span>{order.notes}</span>
            </div>
          </>
        )}

        {/* QR Code */}
        <hr className="border-dashed my-3" />
        <div className="flex flex-col items-center gap-2">
          <QRCodeSVG value={trackingUrl} size={100} />
          <p className="text-xs text-muted-foreground text-center">{t("receipt.trackYourOrder")}</p>
        </div>

        {/* Invoice Footer */}
        {order.branch.invoiceFooter && (
          <>
            <hr className="border-dashed my-3" />
            <p className="text-xs text-muted-foreground text-center whitespace-pre-line">
              {order.branch.invoiceFooter}
            </p>
          </>
        )}

        {/* Footer */}
        <hr className="border-dashed my-3" />
        <div className="text-center text-sm">
          <p className="font-medium">{t("receipt.thankYou")}</p>
          {order.branch.phone && (
            <p className="text-muted-foreground">{t("receipt.contact")}: {order.branch.phone}</p>
          )}
        </div>
      </div>
    </div>
  );
}
