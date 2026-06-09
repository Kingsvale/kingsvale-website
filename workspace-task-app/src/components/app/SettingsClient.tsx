"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Save, Trash2, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { UserLite, WorkspaceData } from "@/types/workspace";

export function SettingsClient({ user, workspace: initialWorkspace }: { user: UserLite; workspace: WorkspaceData }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [name, setName] = useState(initialWorkspace.name);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const currentRole = workspace.members.find((member) => member.userId === user.id)?.role ?? "VIEWER";
  const canAdmin = ["OWNER", "ADMIN"].includes(currentRole);

  async function refresh() {
    const response = await fetch(`/api/workspaces/${workspace.id}`, { cache: "no-store" });
    if (response.ok) {
      const body = await response.json();
      setWorkspace(body.workspace);
    }
  }

  async function saveWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    setMessage(response.ok ? "Workspace updated" : "Could not update workspace");
    await refresh();
    router.refresh();
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/workspaces/${workspace.id}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setInviteLink(body.inviteLink);
      setInviteEmail("");
      setMessage("Invite created");
      await refresh();
    } else {
      setMessage(body.error || "Could not create invite");
    }
  }

  async function updateMember(memberId: string, role: string) {
    const response = await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    setMessage(response.ok ? "Member role updated" : "Could not update member");
    await refresh();
  }

  async function removeMember(memberId: string) {
    const response = await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, { method: "DELETE" });
    setMessage(response.ok ? "Member removed" : "Could not remove member");
    await refresh();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
      <Link href={`/app/workspaces/${workspace.id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to workspace
      </Link>

      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-bright">Workspace settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{workspace.name}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="glass-panel spotlight rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold">General</h2>
          <form onSubmit={saveWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label>Workspace name</Label>
              <Input disabled={!canAdmin} value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.035] p-3 text-sm text-foreground-muted">
              <p>Slug: {workspace.slug}</p>
              <p>Access: {workspace.type.toLowerCase()}</p>
              <p>Your role: {currentRole.toLowerCase()}</p>
            </div>
            {canAdmin ? (
              <Button variant="primary" type="submit">
                <Save className="h-4 w-4" />
                Save changes
              </Button>
            ) : null}
          </form>
        </section>

        <section className="glass-panel spotlight rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Members</h2>
            <Badge tone="accent">{workspace.members.length} people</Badge>
          </div>
          <div className="space-y-2">
            {workspace.members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2">
                <Avatar name={member.user.name} email={member.user.email} color={member.user.avatarColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.user.name}</p>
                  <p className="truncate text-xs text-foreground-muted">{member.user.email}</p>
                </div>
                {canAdmin ? (
                  <select
                    className="h-9 rounded-lg border border-white/10 bg-[#0f0f12] px-2 text-xs"
                    value={member.role}
                    disabled={member.role === "OWNER" && currentRole !== "OWNER"}
                    onChange={(event) => updateMember(member.id, event.target.value)}
                  >
                    {["OWNER", "ADMIN", "MEMBER", "VIEWER"].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                ) : (
                  <Badge>{member.role}</Badge>
                )}
                {canAdmin && member.role !== "OWNER" ? (
                  <Button variant="ghost" size="icon" onClick={() => removeMember(member.id)} aria-label="Remove member">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel spotlight rounded-2xl p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Invitations</h2>
          {canAdmin ? (
            <form onSubmit={invite} className="mb-5 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <Input type="email" required placeholder="teammate@example.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
              <select className="h-10 rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                {["ADMIN", "MEMBER", "VIEWER"].map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
              <Button variant="primary" type="submit">
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            </form>
          ) : null}
          {inviteLink ? (
            <div className="mb-4 rounded-xl border border-accent/25 bg-accent/10 p-3">
              <p className="mb-1 text-xs text-foreground-muted">New invite link</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs text-indigo-100">{inviteLink}</code>
                <Button type="button" variant="ghost" size="icon" onClick={() => navigator.clipboard?.writeText(inviteLink)} aria-label="Copy invite link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            {workspace.invites.map((inviteItem) => (
              <div key={inviteItem.id} className="rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-sm">
                <p>{inviteItem.email}</p>
                <p className="text-xs text-foreground-muted">
                  {inviteItem.role} invite expires {new Date(inviteItem.expiresAt).toLocaleDateString()}
                </p>
              </div>
            ))}
            {workspace.invites.length === 0 ? <p className="text-sm text-foreground-muted">No pending invites.</p> : null}
          </div>
        </section>
      </div>
      {message ? <p className="mt-4 text-sm text-indigo-100">{message}</p> : null}
    </main>
  );
}
