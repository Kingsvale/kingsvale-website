import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { getWorkspaceForUser } from "@/lib/workspace-data";
import { workspaceSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(params.workspaceId, user.id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({ workspace });
}

export async function PATCH(request: Request, { params }: { params: { workspaceId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.ADMIN);
    const input = workspaceSchema.partial().parse(await readJson(request));
    const workspace = await prisma.workspace.update({
      where: { id: params.workspaceId },
      data: {
        name: input.name,
        type: input.type
      }
    });

    emitWorkspaceEvent(params.workspaceId, "workspace:updated", workspace);
    return NextResponse.json({ workspace });
  } catch (error) {
    return apiError(error);
  }
}
