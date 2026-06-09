import { NextResponse } from "next/server";
import { TaskStatus, WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { taskUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; taskId: string }> }
) {
  try {
    const params = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.MEMBER);
    const input = taskUpdateSchema.parse(await readJson(request));
    const existing = await prisma.task.findFirst({
      where: { id: params.taskId, workspaceId: params.workspaceId },
      include: { assignee: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    let nextStatus = input.status ?? existing.status;
    let nextListId = input.listId ?? existing.listId;

    if (input.listId) {
      const list = await prisma.taskList.findUnique({ where: { id: input.listId } });
      if (!list || list.boardId !== existing.boardId) {
        return NextResponse.json({ error: "Target list is not part of this board." }, { status: 422 });
      }
      nextStatus = list.status;
      nextListId = list.id;
    }

    if (input.assigneeId) {
      const assignee = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: params.workspaceId,
            userId: input.assigneeId
          }
        }
      });
      if (!assignee) {
        return NextResponse.json({ error: "Assignee is not a workspace member." }, { status: 422 });
      }
    }

    const archivedAt = input.archived === true ? new Date() : input.archived === false ? null : existing.archivedAt;
    const completedAt =
      nextStatus === TaskStatus.DONE && existing.status !== TaskStatus.DONE
        ? new Date()
        : nextStatus !== TaskStatus.DONE
          ? null
          : existing.completedAt;

    const task = await prisma.$transaction(async (tx) => {
      if (input.labels) {
        await tx.taskLabel.deleteMany({ where: { taskId: existing.id } });
      }

      const updated = await tx.task.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          assigneeId: input.assigneeId === undefined ? undefined : input.assigneeId,
          dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
          listId: nextListId,
          status: nextStatus,
          archivedAt,
          completedAt,
          labels: input.labels?.length ? { create: input.labels } : undefined
        },
        include: {
          assignee: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarColor: true,
              imageUrl: true
            }
          },
          reporter: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarColor: true,
              imageUrl: true
            }
          },
          labels: true,
          checklistItems: { orderBy: { position: "asc" } },
          comments: {
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
            },
            orderBy: { createdAt: "asc" }
          }
        }
      });

      const moved = existing.listId !== nextListId || existing.status !== nextStatus;
      await tx.taskActivity.create({
        data: {
          workspaceId: params.workspaceId,
          taskId: existing.id,
          actorId: user.id,
          action: input.archived ? "task.archived" : moved ? "task.moved" : "task.updated",
          message: `${user.name} ${input.archived ? "archived" : moved ? "moved" : "updated"} ${updated.title}`
        }
      });

      if (input.assigneeId && input.assigneeId !== existing.assigneeId && input.assigneeId !== user.id) {
        await tx.notification.create({
          data: {
            workspaceId: params.workspaceId,
            userId: input.assigneeId,
            type: "assignment",
            title: "Task assigned to you",
            body: `${user.name} assigned ${updated.title} to you.`,
            link: `/app/workspaces/${params.workspaceId}?task=${updated.id}`
          }
        });
      }

      return updated;
    });

    emitWorkspaceEvent(
      params.workspaceId,
      input.archived ? "task:archived" : existing.listId !== nextListId ? "task:moved" : "task:updated",
      task
    );

    if (input.assigneeId && input.assigneeId !== existing.assigneeId && input.assigneeId !== user.id) {
      emitWorkspaceEvent(params.workspaceId, "notification:created", { userId: input.assigneeId });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; taskId: string }> }
) {
  try {
    const params = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.MEMBER);
    const task = await prisma.task.updateMany({
      where: { id: params.taskId, workspaceId: params.workspaceId },
      data: { archivedAt: new Date() }
    });

    if (task.count === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await prisma.taskActivity.create({
      data: {
        workspaceId: params.workspaceId,
        taskId: params.taskId,
        actorId: user.id,
        action: "task.archived",
        message: `${user.name} archived a task`
      }
    });

    emitWorkspaceEvent(params.workspaceId, "task:archived", { taskId: params.taskId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
