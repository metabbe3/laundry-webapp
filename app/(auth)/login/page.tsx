"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LogIn, Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError(t("login.invalid"));
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Card className="animate-scale-in relative w-full max-w-[400px] border-0 bg-white/80 px-2 py-1 shadow-2xl shadow-black/[0.04] backdrop-blur-xl dark:bg-[oklch(0.195_0.025_55/0.8)] dark:shadow-black/20">
      <CardHeader className="text-center pb-2 pt-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.72_0.17_75)] to-[oklch(0.65_0.19_65)] shadow-lg shadow-[oklch(0.72_0.17_75/0.25)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-8 w-8 text-white"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M12 2C8 2 4 6 4 10c0 3 2 5 4 6v4a2 2 0 002 2h4a2 2 0 002-2v-4c2-1 4-3 4-6 0-4-4-8-8-8z" />
            <path d="M10 22h4" strokeLinecap="round" />
            <circle cx="10" cy="9" r="1" fill="currentColor" />
            <circle cx="14" cy="9" r="1" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("app.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </CardHeader>
      <CardContent className="pb-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground/80">{t("common.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("login.emailPlaceholder")}
              required
              className="h-11 border-border/60 bg-muted/30 transition-colors placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground/80">{t("users.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t("login.passwordPlaceholder")}
              required
              className="h-11 border-border/60 bg-muted/30 transition-colors placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-sm font-medium text-destructive">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="h-11 w-full bg-gradient-to-r from-[oklch(0.72_0.17_75)] to-[oklch(0.68_0.19_65)] text-base font-semibold shadow-md shadow-[oklch(0.72_0.17_75/0.2)] transition-all hover:shadow-lg hover:shadow-[oklch(0.72_0.17_75/0.3)] hover:brightness-105"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            {t("login.signIn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
