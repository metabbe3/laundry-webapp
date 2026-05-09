# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal laundry management web app for a small laundry business. Single-user system with customer tracking (by phone), order lifecycle management (Received → In Progress → Ready → Delivered), per-KG/per-item pricing, and multiple payment methods (Cash, Deposit, QRIS).

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-nova style, `rsc: false`)
- **Database**: MySQL via Prisma ORM v7 with `@prisma/adapter-mariadb`
- **Auth**: Auth.js v5 (next-auth beta) with Credentials provider + JWT sessions
- **Validation**: Zod v4
- **Icons**: Lucide React
- **Path aliases**: `@/*` maps to project root

## Commands

```bash
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Production build
npm run lint                   # ESLint (core-web-vitals + TypeScript rules)
npx prisma migrate dev         # Run database migrations
npx prisma generate            # Regenerate Prisma client
npx tsx prisma/seed.ts         # Seed database (admin user + default services)
```

## Architecture

### Route Structure
- `app/(auth)/login/` — Login page (no sidebar)
- `app/(dashboard)/` — All authenticated pages with sidebar layout
- `app/api/` — REST API routes (all protected by auth check)

### Prisma Client
- Generated to `app/generated/prisma/` (gitignored)
- Import `PrismaClient` from `@/app/generated/prisma/client`
- Import enums from `@/app/generated/prisma/enums`
- Singleton with mariadb adapter in `lib/prisma.ts`
- Schema in `prisma/schema.prisma` (provider: mysql)

### Key Files
- `lib/auth.ts` — Auth.js v5 config (Credentials + JWT)
- `lib/validations.ts` — Zod schemas for all entities
- `lib/constants.ts` — Status colors, labels, order flow
- `lib/format.ts` — Currency (IDR), date formatters
- `middleware.ts` — Session cookie check for route protection

### Models
- **User** — Single owner account (email/password)
- **Customer** — Name, phone, email, notes (no login)
- **Service** — Name, pricingType (PER_KG/PER_ITEM), basePrice, isActive
- **Order** — orderNumber (ORD-YYYYMMDD-XXXX), customer, status, total/paid amounts, payment status, status timestamps
- **OrderItem** — Line items linked to Service with quantity/weight/price
- **Payment** — Amount, method, notes per order (supports partial payments)

### shadcn/ui (base-nova style)
- Components use `render` prop instead of `asChild` (base-nova pattern)
- `Select.onValueChange` receives `string | null`, not just `string`
- All components in `components/ui/`

### Default Login
- Email: `admin@laundry.com`, Password: `admin123`
