import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const workspaceId = searchParams.get("workspaceId") ?? undefined;

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, workspaceId },
    select: { workspaceId: true }
  });
  const workspaceIds = memberships.map((membership) => membership.workspaceId);

  const [tasks, projects, comments] = await Promise.all([
    prisma.task.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        archivedAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } }
        ]
      },
      take: 8,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.project.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } }
        ]
      },
      take: 5,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.taskComment.findMany({
      where: {
        body: { contains: q, mode: "insensitive" },
        task: { workspaceId: { in: workspaceIds }, archivedAt: null }
      },
      include: { task: true, author: true },
      take: 5,
      orderBy: { createdAt: "desc" }
    })
  ]);

  return NextResponse.json({
    results: [
      ...tasks.map((task) => ({
        id: task.id,
        type: "task",
        title: task.title,
        subtitle: task.description,
        href: `/app/workspaces/${task.workspaceId}?task=${task.id}`
      })),
      ...projects.map((project) => ({
        id: project.id,
        type: "project",
        title: project.name,
        subtitle: project.description,
        href: `/app/workspaces/${project.workspaceId}?project=${project.id}`
      })),
      ...comments.map((comment) => ({
        id: comment.id,
        type: "comment",
        title: `Comment by ${comment.author.name}`,
        subtitle: comment.body,
        href: `/app/workspaces/${comment.task.workspaceId}?task=${comment.taskId}`
      }))
    ]
  });
}
