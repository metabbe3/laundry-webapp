import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { BUSINESS_NAME_KEY } from "@/lib/constants";

const BUSINESS_NAME_FALLBACK = "Laundry App";
import { buildDateFilter, formatCurrency } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(req: Request) {
  const bf = await getBranchFilter();
  if (bf.error) return bf.error;
  const { branchId } = bf;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "revenue";
  const fromStr = searchParams.get("from") || "";
  const toStr = searchParams.get("to") || "";

  const { where, hasFilter, dateFilter } = buildDateFilter(fromStr, toStr);

  const doc = new jsPDF();
  // Fetch branch name for the report title
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  const businessName = branch?.name || BUSINESS_NAME_FALLBACK;
  const title = `${businessName} — ${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const periodLabel = fromStr || toStr ? `${fromStr || "All"} to ${toStr || "Present"}` : "All time";
  doc.text(`Period: ${periodLabel}`, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, 14, 36);

  switch (type) {
    case "revenue":
      await buildRevenuePdf(doc, where, dateFilter, branchId);
      break;
    case "orders":
      await buildOrdersPdf(doc, where, dateFilter, branchId);
      break;
    case "customers":
      await buildCustomersPdf(doc, where, branchId);
      break;
    case "services":
      await buildServicesPdf(doc, where, dateFilter, branchId);
      break;
    case "commission":
      await buildCommissionPdf(doc, dateFilter, branchId);
      break;
    case "outstanding":
      await buildOutstandingPdf(doc, where, branchId);
      break;
    case "expenses":
      await buildExpensesPdf(doc, dateFilter, branchId);
      break;
    case "profit":
      await buildProfitPdf(doc, where, dateFilter, branchId);
      break;
    case "inventory":
      await buildInventoryPdf(doc, dateFilter, branchId);
      break;
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${type}-report-${fromStr}-to-${toStr}.pdf"`,
    },
  });
}

async function buildRevenuePdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchId: string) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const paymentWhere = hasDateFilter ? { order: { createdAt: dateFilter, branchId } } : { order: { branchId } };

  const [agg, paymentsByMethod] = await Promise.all([
    prisma.order.aggregate({
      where: { ...where, branchId },
      _count: true,
      _sum: { totalAmount: true, discountAmount: true, paidAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: paymentWhere,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Summary section
  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Gross Revenue", formatCurrency(Number(agg._sum.totalAmount ?? 0))],
      ["Discounts", formatCurrency(Number(agg._sum.discountAmount ?? 0))],
      ["Net Revenue", formatCurrency(Number(agg._sum.totalAmount ?? 0) - Number(agg._sum.discountAmount ?? 0))],
      ["Total Paid", formatCurrency(Number(agg._sum.paidAmount ?? 0))],
      ["Orders", String(agg._count)],
    ],
    theme: "grid",
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [255, 251, 235] },
  });

  // Payment methods
  if (paymentsByMethod.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastY = (doc as any).lastAutoTable?.finalY ?? 120;
    autoTable(doc, {
      startY: lastY + 10,
      head: [["Payment Method", "Count", "Total"]],
      body: paymentsByMethod.map((p) => [p.paymentMethod, String(p._count), formatCurrency(Number(p._sum.amount ?? 0))]),
      theme: "grid",
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });
  }
}

async function buildOrdersPdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchId: string) {
  const [statusGroups, deliveredOrders, totalOrders] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { ...where, branchId }, _count: true, _sum: { totalAmount: true } }),
    prisma.order.findMany({ where: { ...where, deliveredAt: { not: null }, branchId }, select: { createdAt: true, deliveredAt: true } }),
    prisma.order.count({ where: { ...where, branchId } }),
  ]);

  const turnaroundHours = deliveredOrders.map((o) => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60));
  const avgTurnaround = turnaroundHours.length > 0 ? Math.round((turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length) * 10) / 10 : null;

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Orders", String(totalOrders)],
      ["Avg Turnaround (hours)", avgTurnaround !== null ? String(avgTurnaround) : "N/A"],
      ["Delivered", String(turnaroundHours.length)],
    ],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? 100;
  autoTable(doc, {
    startY: lastY + 10,
    head: [["Status", "Count", "Total Amount"]],
    body: statusGroups.map((s) => [s.status, String(s._count), formatCurrency(Number(s._sum.totalAmount ?? 0))]),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
  });
}

async function buildCustomersPdf(doc: jsPDF, where: object, branchId: string) {
  const [totalCustomers, newCount, topSpenders] = await Promise.all([
    prisma.customer.count({ where: { branchId } }),
    prisma.customer.count({ where: { ...where, branchId } }),
    prisma.order.groupBy({
      by: ["customerId"], where: { ...where, branchId },
      _sum: { totalAmount: true }, _count: true,
      orderBy: { _sum: { totalAmount: "desc" } }, take: 20,
    }),
  ]);

  const spenderIds = topSpenders.map((s) => s.customerId);
  const spenderCustomers = spenderIds.length > 0
    ? await prisma.customer.findMany({ where: { id: { in: spenderIds }, branchId }, select: { id: true, name: true } })
    : [];
  const spenderMap = new Map(spenderCustomers.map((c) => [c.id, c.name]));

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Customers", String(totalCustomers)],
      ["New in Period", String(newCount)],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
  });

  if (topSpenders.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? 100;
    autoTable(doc, {
      startY: lastY + 10,
      head: [["#", "Customer", "Orders", "Total Spent"]],
      body: topSpenders.map((s, i) => [
        String(i + 1),
        spenderMap.get(s.customerId) ?? "Unknown",
        String(s._count),
        formatCurrency(Number(s._sum.totalAmount ?? 0)),
      ]),
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
      alternateRowStyles: { fillColor: [236, 253, 245] },
    });
  }
}

async function buildServicesPdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchId: string) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const itemWhere = hasDateFilter ? { order: { createdAt: dateFilter, branchId } } : { order: { branchId } };

  const [serviceGroups, allServices] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["serviceId"], where: itemWhere,
      _sum: { quantity: true, weightKg: true, subtotal: true }, _count: true,
      orderBy: { _sum: { subtotal: "desc" } },
    }),
    prisma.service.findMany({ where: { isActive: true, branchId }, select: { id: true, name: true } }),
  ]);

  const serviceMap = new Map(allServices.map((s) => [s.id, s.name]));

  autoTable(doc, {
    startY: 44,
    head: [["Service", "Orders", "Revenue", "Avg Value"]],
    body: serviceGroups.map((g) => [
      serviceMap.get(g.serviceId) ?? "Unknown",
      String(g._count),
      formatCurrency(Number(g._sum.subtotal ?? 0)),
      formatCurrency(g._count > 0 ? Number(g._sum.subtotal ?? 0) / g._count : 0),
    ]),
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [245, 243, 255] },
  });
}

async function buildCommissionPdf(doc: jsPDF, dateFilter: { gte?: Date; lte?: Date }, branchId: string) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const itemWhere = hasDateFilter ? { order: { createdAt: dateFilter, branchId } } : { order: { branchId } };

  const [serviceGroups, allServices] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["serviceId"], where: itemWhere,
      _sum: { quantity: true, weightKg: true, subtotal: true }, _count: true,
    }),
    prisma.service.findMany({ where: { branchId }, select: { id: true, name: true, pricingType: true, commissionType: true, commissionValue: true } }),
  ]);

  const serviceMap = new Map(allServices.map((s) => [s.id, s]));

  const rows = serviceGroups.map((g) => {
    const svc = serviceMap.get(g.serviceId);
    const revenue = Number(g._sum.subtotal ?? 0);
    const totalWeightKg = Number(g._sum.weightKg ?? 0);
    const totalQty = Number(g._sum.quantity ?? 0);
    const commType = svc?.commissionType ?? "NONE";
    const commValue = Number(svc?.commissionValue ?? 0);

    let commission = 0;
    if (commType === "FLAT") {
      commission = svc?.pricingType === "PER_KG" ? commValue * totalWeightKg : commValue * totalQty;
    } else if (commType === "PERCENTAGE") {
      commission = revenue * (commValue / 100);
    }

    return [
      svc?.name ?? "Unknown",
      String(g._count),
      formatCurrency(revenue),
      commType === "NONE" ? "—" : commType === "FLAT" ? formatCurrency(commValue) : `${commValue}%`,
      formatCurrency(Math.round(commission)),
    ];
  });

  autoTable(doc, {
    startY: 44,
    head: [["Service", "Orders", "Revenue", "Commission", "Earned"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
  });
}

async function buildOutstandingPdf(doc: jsPDF, where: object, branchId: string) {
  const outstandingOrders = await prisma.order.findMany({
    where: { paymentStatus: { in: ["PENDING", "PARTIAL"] }, ...where, branchId },
    select: {
      totalAmount: true, paidAmount: true, createdAt: true,
      customer: { select: { name: true, phone: true } },
    },
  });

  const customerMap = new Map<string, { name: string; phone: string; totalOutstanding: number; orderCount: number }>();
  for (const o of outstandingOrders) {
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    const existing = customerMap.get(o.customer.name);
    if (existing) {
      existing.totalOutstanding += outstanding;
      existing.orderCount++;
    } else {
      customerMap.set(o.customer.name, { name: o.customer.name, phone: o.customer.phone, totalOutstanding: outstanding, orderCount: 1 });
    }
  }

  const rows = Array.from(customerMap.values())
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .map((c) => [c.name, c.phone, formatCurrency(c.totalOutstanding), String(c.orderCount)]);

  autoTable(doc, {
    startY: 44,
    head: [["Customer", "Phone", "Outstanding", "Orders"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [254, 242, 242] },
  });
}

async function buildExpensesPdf(doc: jsPDF, dateFilter: { gte?: Date; lte?: Date }, branchId: string) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const expenseWhere: Record<string, unknown> = { branchId };
  if (hasDateFilter) expenseWhere.date = dateFilter;

  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where: expenseWhere,
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    prisma.expenseCategory.findMany({ where: { branchId } }),
  ]);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Summary
  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Expenses", formatCurrency(totalExpenses)],
      ["Categories", String(categories.length)],
      ["Entries", String(expenses.length)],
    ],
    theme: "grid",
    headStyles: { fillColor: [244, 63, 94], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [255, 241, 242] },
  });

  // By category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY1 = (doc as any).lastAutoTable?.finalY ?? 100;
  const categoryMap = new Map<string, { name: string; total: number; count: number }>();
  for (const e of expenses) {
    const catName = e.category?.name ?? "Unknown";
    const existing = categoryMap.get(catName);
    if (existing) {
      existing.total += Number(e.amount);
      existing.count++;
    } else {
      categoryMap.set(catName, { name: catName, total: Number(e.amount), count: 1 });
    }
  }

  autoTable(doc, {
    startY: lastY1 + 10,
    head: [["Category", "Entries", "Total"]],
    body: Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .map((c) => [c.name, String(c.count), formatCurrency(c.total)]),
    theme: "grid",
    headStyles: { fillColor: [244, 63, 94], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [255, 241, 242] },
  });
}

async function buildProfitPdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchId: string) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const expenseWhere: Record<string, unknown> = { branchId };
  if (hasDateFilter) expenseWhere.date = dateFilter;

  const [revenueAgg, totalExpenses] = await Promise.all([
    prisma.order.aggregate({
      where: { ...where, branchId },
      _sum: { totalAmount: true, discountAmount: true },
    }),
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.totalAmount ?? 0);
  const discount = Number(revenueAgg._sum.discountAmount ?? 0);
  const netRevenue = revenue - discount;
  const expenses = Number(totalExpenses._sum.amount ?? 0);
  const profit = netRevenue - expenses;
  const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Revenue", formatCurrency(revenue)],
      ["Discounts", formatCurrency(discount)],
      ["Net Revenue", formatCurrency(netRevenue)],
      ["Total Expenses", formatCurrency(expenses)],
      ["Net Profit", formatCurrency(profit)],
      ["Margin", `${margin.toFixed(1)}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
  });
}

async function buildInventoryPdf(doc: jsPDF, dateFilter: { gte?: Date; lte?: Date }, branchId: string) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const movementWhere: Record<string, unknown> = {};
  if (hasDateFilter) movementWhere.date = dateFilter;

  const [stockItems, movements] = await Promise.all([
    prisma.stockItem.findMany({
      where: { isActive: true, branchId },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { stockItem: { branchId }, ...movementWhere },
      include: { stockItem: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  const totalValue = stockItems.reduce(
    (sum, i) => sum + Number(i.currentQuantity) * Number(i.purchasePricePerUnit), 0
  );
  const lowStockCount = stockItems.filter(
    (i) => Number(i.currentQuantity) <= Number(i.lowStockThreshold)
  ).length;
  const inMovements = movements.filter((m) => m.type === "IN").length;

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Items", String(stockItems.length)],
      ["Total Value", formatCurrency(totalValue)],
      ["Low Stock Items", String(lowStockCount)],
      ["Stock In (Period)", String(inMovements)],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  });

  // Stock levels table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? 120;
  autoTable(doc, {
    startY: lastY + 10,
    head: [["Item", "Unit", "Quantity", "Threshold", "Value"]],
    body: stockItems.map((i) => [
      i.name,
      i.unit,
      String(Number(i.currentQuantity)),
      String(Number(i.lowStockThreshold)),
      formatCurrency(Number(i.currentQuantity) * Number(i.purchasePricePerUnit)),
    ]),
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  });
}
