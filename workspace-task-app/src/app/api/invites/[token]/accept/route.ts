import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { normalizeEmail } from "@/lib/strings";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const params = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in before accepting this invite." }, { status: 401 });
    }

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: params.token },
      include: { workspace: true }
    });

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite is no longer valid." }, { status: 404 });
    }

    if (normalizeEmail(invite.email) !== normalizeEmail(user.email)) {
      return NextResponse.json({ error: `This invite is for ${invite.email}.` }, { status: 403 });
    }

    const membership = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: user.id
        }
      },
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role
      },
      update: {}
    });

    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() }
    });

    await prisma.taskActivity.create({
      data: {
        workspaceId: invite.workspaceId,
        actorId: user.id,
        action: "member.joined",
        message: `${user.name} joined ${invite.workspace.name}`
      }
    });

    emitWorkspaceEvent(invite.workspaceId, "member:joined", { userId: user.id, workspaceId: invite.workspaceId });
    return NextResponse.json({ membership, workspaceId: invite.workspaceId });
  } catch (error) {
    return apiError(error);
  }
}
