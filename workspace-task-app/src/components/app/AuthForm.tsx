"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const isRegister = mode === "register";
  const copy = useMemo(
    () =>
      isRegister
        ? {
            title: "Create your workspace",
            body: "Start with a private workspace, then invite teammates when the board is ready.",
            submit: "Create account",
            alt: "Already have an account?",
            href: "/login",
            hrefText: "Log in"
          }
        : {
            title: "Welcome back",
            body: "Log in to your live boards, task comments, notifications, and workspace activity.",
            submit: "Log in",
            alt: "New to TaskForge?",
            href: "/register",
            hrefText: "Create an account"
          },
    [isRegister]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isRegister ? form : { email: form.email, password: form.password })
    });

    const body = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(body.error || "Authentication failed.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="glass-panel spotlight w-full max-w-md rounded-2xl p-6 sm:p-8">
        <div className="mb-8">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Lock className="h-5 w-5 text-indigo-200" />
          </div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-bright">TaskForge</p>
          <h1 className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            {copy.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground-muted">{copy.body}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {isRegister ? (
            <div className="space-y-2">
              <Label>Name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="pl-9"
                  placeholder="Ada Lovelace"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="pl-9"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              required
              type="password"
              minLength={isRegister ? 10 : 1}
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={isRegister ? "At least 10 characters" : "Your password"}
            />
          </div>

          {error ? <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {copy.submit}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground-muted">
          {copy.alt}{" "}
          <Link className="text-indigo-200 hover:text-white" href={copy.href}>
            {copy.hrefText}
          </Link>
        </p>
      </section>
    </main>
  );
}
