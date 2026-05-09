import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

declare module "next-auth" {
  interface Session { user: { id: string; name: string; email: string; role: UserRole; branchId: string; branchName: string } }
  interface User { role: UserRole; branchId: string; branchName: string }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { branch: { select: { id: true, name: true } } },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role, branchId: user.branchId, branchName: user.branch.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).role = user.role as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).branchId = user.branchId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).branchName = user.branchName;
      }
      if (trigger === "update" && session?.selectedBranchId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).selectedBranchId = session.selectedBranchId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).selectedBranchName = session.selectedBranchName ?? "";
      }
      return token;
    },
    session: async ({ session, token }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = token as any;
      session.user.id = token.sub ?? "";
      session.user.name = token.name ?? "";
      session.user.email = token.email ?? "";
      session.user.role = (t.role as UserRole) ?? "EMPLOYEE";

      const selectedBranchId = t.selectedBranchId;
      if (selectedBranchId && t.role === "OWNER") {
        session.user.branchId = selectedBranchId;
        session.user.branchName = (t.selectedBranchName || t.branchName) ?? "";
      } else {
        session.user.branchId = t.branchId ?? "";
        session.user.branchName = t.branchName ?? "";
      }

      return session;
    },
  },
});

/**
 * Helper for API routes that require OWNER authentication.
 * Returns NextResponse if unauthorized, null otherwise.
 * Use: const err = await requireOwnerAuth(); if (err) return err;
 */
export async function requireOwnerAuth(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
