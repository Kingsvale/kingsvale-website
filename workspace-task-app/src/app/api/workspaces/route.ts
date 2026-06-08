import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { defaultBoardCreate } from "@/lib/defaults";
import { projectKey, slugify } from "@/lib/strings";
import { workspaceSchema } from "@/lib/validators";
import { emitWorkspaceEvent } from "@/lib/realtime";
import { getUserWorkspaces } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  return NextResponse.json({ workspaces: await getUserWorkspaces(user.id) });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const input = workspaceSchema.parse(await readJson(request));
    const baseSlug = slugify(input.name) || "workspace";
    const slug = await uniqueWorkspaceSlug(baseSlug);
    const key = await uniqueProjectKey(input.name, "");

    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        slug,
        type: input.type,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: WorkspaceRole.OWNER
          }
        },
        projects: {
          create: {
            name: "General",
            key,
            description: "A shared project space for first tasks and planning.",
            favorite: true,
            boards: {
              create: defaultBoardCreate()
            }
          }
        }
      }
    });

    emitWorkspaceEvent(workspace.id, "workspace:updated", { id: workspace.id, name: workspace.name });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

async function uniqueWorkspaceSlug(base: string) {
  let candidate = base;
  let suffix = 1;
  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

async function uniqueProjectKey(name: string, workspaceId: string) {
  const base = projectKey(name);
  if (!workspaceId) return base;
  let candidate = base;
  let suffix = 1;
  while (await prisma.project.findUnique({ where: { workspaceId_key: { workspaceId, key: candidate } } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}
