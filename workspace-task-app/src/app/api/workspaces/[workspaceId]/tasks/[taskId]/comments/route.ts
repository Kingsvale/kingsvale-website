import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { mentionedMemberIds } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { commentSchema } from "@/lib/validators";
import { getWorkspaceForUser } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { workspaceId: string; taskId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.MEMBER);
    const input = commentSchema.parse(await readJson(request));
    const workspace = await getWorkspaceForUser(params.workspaceId, user.id);
    const task = await prisma.task.findFirst({ where: { id: params.taskId, workspaceId: params.workspaceId } });
    if (!workspace || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const mentioned = mentionedMemberIds(input.body, workspace).filter((id) => id !== user.id);

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.taskComment.create({
        data: {
          taskId: params.taskId,
          authorId: user.id,
          body: input.body
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarColor: true,
              imageUrl: true
            }
          }
        }
      });

      await tx.taskActivity.create({
        data: {
          workspaceId: params.workspaceId,
          taskId: params.taskId,
          actorId: user.id,
          action: "task.commented",
          message: `${user.name} commented on ${task.title}`
        }
      });

      if (mentioned.length > 0) {
        await tx.notification.createMany({
          data: mentioned.map((userId) => ({
            workspaceId: params.workspaceId,
            userId,
            type: "mention",
            title: `${user.name} mentioned you`,
            body: input.body.slice(0, 180),
            link: `/app/workspaces/${params.workspaceId}?task=${params.taskId}`
          }))
        });
      }

      return created;
    });

    emitWorkspaceEvent(params.workspaceId, "task:commented", { taskId: params.taskId, comment });
    if (mentioned.length > 0) {
      emitWorkspaceEvent(params.workspaceId, "notification:created", { userIds: mentioned });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
