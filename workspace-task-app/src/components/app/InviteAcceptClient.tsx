"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InviteAcceptClient({
  token,
  invite,
  user
}: {
  token: string;
  invite: { email: string; role: string; workspaceName: string; invitedBy: string };
  user: { id: string; email: string; name: string } | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    const response = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(body.error || "Could not accept invite.");
      return;
    }
    router.push(`/app/workspaces/${body.workspaceId}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="glass-panel spotlight w-full max-w-md rounded-2xl p-6 text-center">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-accent text-white shadow-accent">
          <UserPlus className="h-5 w-5" />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent-bright">Workspace invite</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{invite.workspaceName}</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          {invite.invitedBy} invited {invite.email} as {invite.role.toLowerCase()}.
        </p>

        {user ? (
          <div className="mt-6">
            <p className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-sm text-foreground-muted">
              Signed in as {user.email}
            </p>
            <Button variant="primary" onClick={accept} disabled={loading}>
              <ArrowRight className="h-4 w-4" />
              Accept invite
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex justify-center gap-2">
            <Link href={`/login?next=/invite/${token}`}>
              <Button variant="primary">Log in</Button>
            </Link>
            <Link href={`/register?next=/invite/${token}`}>
              <Button>Create account</Button>
            </Link>
          </div>
        )}
        {message ? <p className="mt-4 text-sm text-red-100">{message}</p> : null}
      </section>
    </main>
  );
}
