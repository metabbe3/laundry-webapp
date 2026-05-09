import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../app/generated/prisma/client.js";
import bcrypt from "bcrypt";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || "localhost",
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "laundry_db",
  port: Number(process.env.DATABASE_PORT) || 3306,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Create default branch first
  const branch = await prisma.branch.upsert({
    where: { id: "main-branch" },
    update: {},
    create: {
      id: "main-branch",
      name: "Main Branch",
      address: "Default branch",
    },
  });

  const password = process.env.ADMIN_PASSWORD || "admin123";
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("WARNING: Using default admin password. Set ADMIN_PASSWORD env variable for production.");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email: "admin@laundry.com" },
    update: { role: "OWNER", branchId: branch.id },
    create: {
      email: "admin@laundry.com",
      passwordHash,
      name: "Admin",
      role: "OWNER",
      branchId: branch.id,
    },
  });

  // Sample employee user
  const empPassword = process.env.EMPLOYEE_PASSWORD || "employee123";
  const empPasswordHash = await bcrypt.hash(empPassword, 12);
  await prisma.user.upsert({
    where: { email: "employee@laundry.com" },
    update: { branchId: branch.id },
    create: {
      email: "employee@laundry.com",
      passwordHash: empPasswordHash,
      name: "Employee",
      role: "EMPLOYEE",
      branchId: branch.id,
    },
  });

  const services = [
    { name: "Wash + Fold", pricingType: "PER_KG" as const, basePrice: 7000, description: "Cuci lipat reguler" },
    { name: "Wash + Iron", pricingType: "PER_KG" as const, basePrice: 10000, description: "Cuci setrika" },
    { name: "Dry Clean", pricingType: "PER_ITEM" as const, basePrice: 25000, description: "Dry cleaning premium" },
    { name: "Iron Only", pricingType: "PER_KG" as const, basePrice: 5000, description: "Setrika saja" },
    { name: "Wash Shoes", pricingType: "PER_ITEM" as const, basePrice: 30000, description: "Cuci sepatu" },
    { name: "Wash Blanket", pricingType: "PER_ITEM" as const, basePrice: 20000, description: "Cuci selimut/sprei" },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: s.name.toLowerCase().replace(/\s+/g, "-"),
        ...s,
        basePrice: s.basePrice,
        branchId: branch.id,
      },
    });
  }

  // Default expense categories
  const expenseCategories = [
    "Operations",
    "Supplies",
    "Utilities",
    "Rent",
    "Salary",
    "Other",
  ];

  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { id: `cat-${cat.toLowerCase()}` },
      update: {},
      create: {
        id: `cat-${cat.toLowerCase()}`,
        name: cat,
        branchId: branch.id,
      },
    });
  }

  console.log("Seed complete! Login: admin@laundry.com / <configured password>");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
