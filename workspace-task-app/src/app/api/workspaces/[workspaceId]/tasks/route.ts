import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { taskCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.MEMBER);
    const input = taskCreateSchema.parse(await readJson(request));

    const list = await prisma.taskList.findUnique({
      where: { id: input.listId },
      include: {
        board: {
          include: { project: true }
        }
      }
    });

    if (
      !list ||
      list.boardId !== input.boardId ||
      list.board.projectId !== input.projectId ||
      list.board.project.workspaceId !== params.workspaceId
    ) {
      return NextResponse.json({ error: "Task list not found in this workspace." }, { status: 404 });
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

    const maxPosition = await prisma.task.aggregate({
      where: { listId: input.listId, archivedAt: null },
      _max: { position: true }
    });

    const task = await prisma.task.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: input.projectId,
        boardId: input.boardId,
        listId: input.listId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: list.status,
        position: (maxPosition._max.position ?? 0) + 1,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeId: input.assigneeId,
        reporterId: user.id,
        labels: input.labels?.length
          ? {
              create: input.labels
            }
          : undefined
      },
      include: { assignee: true, reporter: true, labels: true, comments: true, checklistItems: true }
    });

    await prisma.taskActivity.create({
      data: {
        workspaceId: params.workspaceId,
        taskId: task.id,
        actorId: user.id,
        action: "task.created",
        message: `${user.name} created ${task.title}`
      }
    });

    if (task.assigneeId && task.assigneeId !== user.id) {
      await prisma.notification.create({
        data: {
          workspaceId: params.workspaceId,
          userId: task.assigneeId,
          type: "assignment",
          title: "New task assigned",
          body: `${user.name} assigned ${task.title} to you.`,
          link: `/app/workspaces/${params.workspaceId}?task=${task.id}`
        }
      });
      emitWorkspaceEvent(params.workspaceId, "notification:created", { userId: task.assigneeId });
    }

    emitWorkspaceEvent(params.workspaceId, "task:created", task);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
