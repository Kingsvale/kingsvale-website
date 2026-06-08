import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { defaultBoardCreate } from "@/lib/defaults";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { projectKey } from "@/lib/strings";
import { projectSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.MEMBER);
    const input = projectSchema.parse(await readJson(request));
    const key = await uniqueProjectKey(params.workspaceId, projectKey(input.name));

    const project = await prisma.project.create({
      data: {
        workspaceId: params.workspaceId,
        name: input.name,
        key,
        description: input.description,
        favorite: input.favorite,
        boards: {
          create: defaultBoardCreate(`${input.name} Board`)
        }
      },
      include: {
        boards: {
          include: {
            lists: { orderBy: { position: "asc" } }
          }
        }
      }
    });

    await prisma.taskActivity.create({
      data: {
        workspaceId: params.workspaceId,
        actorId: user.id,
        action: "project.created",
        message: `${user.name} created ${project.name}`
      }
    });

    emitWorkspaceEvent(params.workspaceId, "project:created", project);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

async function uniqueProjectKey(workspaceId: string, base: string) {
  let candidate = base;
  let suffix = 1;
  while (await prisma.project.findUnique({ where: { workspaceId_key: { workspaceId, key: candidate } } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}
