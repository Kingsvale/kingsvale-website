"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function EmptyAppHome({ userName }: { userName: string }) {
  const router = useRouter();
  const [name, setName] = useState(`${userName.split(" ")[0]}'s Workspace`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "SHARED" })
    });
    const body = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(body.error || "Could not create workspace.");
      return;
    }

    router.push(`/app/workspaces/${body.workspace.id}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="glass-panel spotlight w-full max-w-lg rounded-2xl p-8">
        <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055]">
          <Sparkles className="h-5 w-5 text-indigo-200" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Create your first workspace</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          Workspaces hold projects, boards, members, notifications, and live task activity.
        </p>
        <form onSubmit={createWorkspace} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label>Workspace name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
          </div>
          {error ? <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={loading}>
            <Plus className="h-4 w-4" />
            Create workspace
          </Button>
        </form>
      </section>
    </main>
  );
}
