import { Prisma, TaskStatus, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const workspaceInclude = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarColor: true,
          imageUrl: true
        }
      }
    },
    orderBy: [{ role: "asc" as const }, { createdAt: "asc" as const }]
  },
  invites: {
    where: { acceptedAt: null },
    orderBy: { createdAt: "desc" as const }
  },
  projects: {
    where: { archivedAt: null },
    include: {
      boards: {
        include: {
          lists: {
            orderBy: { position: "asc" as const },
            include: {
              tasks: {
                where: { archivedAt: null },
                orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
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
                  checklistItems: { orderBy: { position: "asc" as const } },
                  comments: {
                    orderBy: { createdAt: "asc" as const },
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
                  },
                  activities: {
                    orderBy: { createdAt: "desc" as const },
                    take: 12,
                    include: {
                      actor: {
                        select: {
                          id: true,
                          email: true,
                          name: true,
                          avatarColor: true,
                          imageUrl: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ favorite: "desc" as const }, { createdAt: "asc" as const }]
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 24,
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarColor: true,
          imageUrl: true
        }
      }
    }
  },
  presence: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarColor: true,
          imageUrl: true
        }
      }
    }
  }
} satisfies Prisma.WorkspaceInclude;

export type WorkspacePayload = Prisma.WorkspaceGetPayload<{
  include: typeof workspaceInclude;
}>;

export async function getUserWorkspaces(userId: string) {
  return prisma.workspace.findMany({
    where: {
      members: {
        some: { userId }
      }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      updatedAt: true,
      members: {
        where: { userId },
        select: { role: true }
      }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getWorkspaceForUser(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      members: {
        some: { userId }
      }
    },
    include: workspaceInclude
  });

  if (!workspace) {
    return null;
  }

  return workspace;
}

export function roleFor(workspace: WorkspacePayload, userId: string): WorkspaceRole {
  return workspace.members.find((member) => member.userId === userId)?.role ?? WorkspaceRole.VIEWER;
}

export function listStatusFallback(name: string): TaskStatus {
  const lower = name.toLowerCase();
  if (lower.includes("backlog")) return TaskStatus.BACKLOG;
  if (lower.includes("progress")) return TaskStatus.IN_PROGRESS;
  if (lower.includes("review")) return TaskStatus.REVIEW;
  if (lower.includes("done")) return TaskStatus.DONE;
  return TaskStatus.TODO;
}
