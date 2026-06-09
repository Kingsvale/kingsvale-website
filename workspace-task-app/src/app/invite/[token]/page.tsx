import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { InviteAcceptClient } from "@/components/app/InviteAcceptClient";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const [invite, user] = await Promise.all([
    prisma.workspaceInvite.findUnique({
      where: { token: resolvedParams.token },
      include: { workspace: true, invitedBy: { select: { name: true, email: true } } }
    }),
    getCurrentUser()
  ]);

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="glass-panel max-w-md rounded-2xl p-6 text-center">
          <h1 className="text-2xl font-semibold">Invite unavailable</h1>
          <p className="mt-2 text-sm text-foreground-muted">This invitation is expired, already accepted, or does not exist.</p>
          <Link href="/app" className="mt-5 inline-flex text-sm text-indigo-200 hover:text-white">
            Go to app
          </Link>
        </section>
      </main>
    );
  }

  return (
    <InviteAcceptClient
      token={resolvedParams.token}
      invite={{
        email: invite.email,
        role: invite.role,
        workspaceName: invite.workspace.name,
        invitedBy: invite.invitedBy.name
      }}
      user={user ? (JSON.parse(JSON.stringify(user)) as { id: string; email: string; name: string }) : null}
    />
  );
}
