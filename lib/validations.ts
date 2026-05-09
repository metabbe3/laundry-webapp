import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  pricingType: z.enum(["PER_KG", "PER_ITEM"]),
  basePrice: z.coerce.number().positive("Price must be positive"),
  commissionType: z.enum(["NONE", "FLAT", "PERCENTAGE"]).optional(),
  commissionValue: z.coerce.number().min(0).optional(),
});

export const orderItemSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  weightKg: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

export const orderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "DEPOSIT", "QRIS"]),
  notes: z.string().optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED"]),
});

export const orderNotesUpdateSchema = z.object({
  notes: z.string().optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

export const branchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  invoiceFooter: z.string().optional(),
});

export const userCreateSchema = z.object({
  email: z.email(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "EMPLOYEE"]),
  branchId: z.string().min(1, "Branch is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "EMPLOYEE"]).optional(),
  branchId: z.string().min(1, "Branch is required").optional(),
  password: z.string().min(6).optional(),
});

export type BranchInput = z.infer<typeof branchSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const stockItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  currentQuantity: z.coerce.number().min(0).optional(),
  lowStockThreshold: z.coerce.number().min(0, "Threshold must be non-negative"),
  purchasePricePerUnit: z.coerce.number().min(0, "Price must be non-negative"),
});

export const stockMovementSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  notes: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

export const expenseCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const expenseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  categoryId: z.string().min(1, "Category is required"),
});

export type StockItemInput = z.infer<typeof stockItemSchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
