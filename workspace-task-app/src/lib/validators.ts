import { TaskPriority, TaskStatus, WorkspaceRole, WorkspaceType } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(10).max(120)
});

export const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(120)
});

export const profileSchema = z.object({
  name: z.string().min(2).max(80),
  timezone: z.string().min(2).max(80)
});

export const workspaceSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.nativeEnum(WorkspaceType).default(WorkspaceType.SHARED)
});

export const inviteSchema = z.object({
  email: z.string().email().max(120),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER)
});

export const memberRoleSchema = z.object({
  role: z.nativeEnum(WorkspaceRole)
});

export const projectSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(240).optional().default(""),
  favorite: z.boolean().optional().default(false)
});

export const taskCreateSchema = z.object({
  projectId: z.string().min(1),
  boardId: z.string().min(1),
  listId: z.string().min(1),
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional().default(""),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  labels: z.array(z.object({ name: z.string().min(1).max(32), color: z.string().min(4).max(24) })).optional()
});

export const taskUpdateSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(4000).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  listId: z.string().min(1).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  archived: z.boolean().optional(),
  labels: z.array(z.object({ name: z.string().min(1).max(32), color: z.string().min(4).max(24) })).optional()
});

export const commentSchema = z.object({
  body: z.string().min(1).max(4000)
});

export const checklistSchema = z.object({
  title: z.string().min(1).max(160),
  completed: z.boolean().optional()
});
