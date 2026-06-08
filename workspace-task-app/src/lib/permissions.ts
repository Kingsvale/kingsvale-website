import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const roleRank: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3
};

export function hasRoleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole) {
  return roleRank[role] >= roleRank[minimum];
}

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId
      }
    },
    include: {
      workspace: true
    }
  });
}

export async function requireWorkspaceRole(userId: string, workspaceId: string, minimum: WorkspaceRole) {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership || !hasRoleAtLeast(membership.role, minimum)) {
    throw Object.assign(new Error("Workspace permission denied"), { status: 403 });
  }
  return membership;
}

export function canEditTasks(role: WorkspaceRole) {
  return hasRoleAtLeast(role, WorkspaceRole.MEMBER);
}

export function canManageMembers(role: WorkspaceRole) {
  return hasRoleAtLeast(role, WorkspaceRole.ADMIN);
}

export function canManageWorkspace(role: WorkspaceRole) {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}
