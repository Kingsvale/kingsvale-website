import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { memberRoleSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: { workspaceId: string; memberId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const actor = await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.ADMIN);
    const input = memberRoleSchema.parse(await readJson(request));
    const target = await prisma.workspaceMember.findUnique({ where: { id: params.memberId } });

    if (!target || target.workspaceId !== params.workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === WorkspaceRole.OWNER || input.role === WorkspaceRole.OWNER) {
      if (actor.role !== WorkspaceRole.OWNER) {
        return NextResponse.json({ error: "Only owners can change owner-level membership." }, { status: 403 });
      }
    }

    const member = await prisma.workspaceMember.update({
      where: { id: params.memberId },
      data: { role: input.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarColor: true,
            imageUrl: true
          }
        }
      }
    });

    emitWorkspaceEvent(params.workspaceId, "workspace:updated", { member });
    return NextResponse.json({ member });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { workspaceId: string; memberId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.ADMIN);
    const target = await prisma.workspaceMember.findUnique({ where: { id: params.memberId } });
    if (!target || target.workspaceId !== params.workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === WorkspaceRole.OWNER) {
      return NextResponse.json({ error: "Workspace owners cannot be removed." }, { status: 403 });
    }

    await prisma.workspaceMember.delete({ where: { id: params.memberId } });
    emitWorkspaceEvent(params.workspaceId, "workspace:updated", { removedMemberId: params.memberId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
