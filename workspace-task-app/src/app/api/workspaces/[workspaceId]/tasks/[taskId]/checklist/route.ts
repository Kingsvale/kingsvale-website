import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { checklistSchema } from "@/lib/validators";

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
    const input = checklistSchema.parse(await readJson(request));
    const task = await prisma.task.findFirst({ where: { id: params.taskId, workspaceId: params.workspaceId } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const maxPosition = await prisma.taskChecklistItem.aggregate({
      where: { taskId: params.taskId },
      _max: { position: true }
    });

    const item = await prisma.taskChecklistItem.create({
      data: {
        taskId: params.taskId,
        title: input.title,
        completed: input.completed ?? false,
        completedAt: input.completed ? new Date() : null,
        completedById: input.completed ? user.id : null,
        position: (maxPosition._max.position ?? 0) + 1
      }
    });

    emitWorkspaceEvent(params.workspaceId, "task:updated", { taskId: params.taskId });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
