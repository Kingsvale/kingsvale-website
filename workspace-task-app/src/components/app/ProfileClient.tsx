"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LogOut, UserCog } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { UserLite } from "@/types/workspace";

export function ProfileClient({ user }: { user: UserLite }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone || "Europe/London");
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, timezone })
    });
    setMessage(response.ok ? "Profile updated" : "Could not update profile");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8">
      <Link href="/app" className="mb-6 inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to workspace
      </Link>
      <section className="glass-panel spotlight rounded-2xl p-6">
        <div className="mb-8 flex items-center gap-4">
          <Avatar name={user.name} email={user.email} color={user.avatarColor} size="lg" />
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent-bright">Account settings</p>
            <h1 className="text-3xl font-semibold tracking-tight">{user.name}</h1>
            <p className="text-sm text-foreground-muted">{user.email}</p>
          </div>
        </div>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" variant="primary">
              <Check className="h-4 w-4" />
              Save profile
            </Button>
            <Button type="button" variant="secondary" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </form>

        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.035] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <UserCog className="h-4 w-4 text-indigo-200" />
            Security
          </div>
          <p className="text-sm leading-relaxed text-foreground-muted">
            Sessions are stored in signed HttpOnly cookies. Passwords are hashed with bcrypt before storage.
          </p>
        </div>

        {message ? <p className="mt-4 text-sm text-indigo-100">{message}</p> : null}
      </section>
    </main>
  );
}
