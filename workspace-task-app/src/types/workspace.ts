import type { TaskPriority, TaskStatus, WorkspaceRole, WorkspaceType } from "@prisma/client";

export type UserLite = {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  imageUrl?: string | null;
  timezone?: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  updatedAt: string;
  members: { role: WorkspaceRole }[];
};

export type Member = {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  user: UserLite;
};

export type Invite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
  position: number;
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: UserLite;
};

export type TaskActivity = {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  actor?: UserLite | null;
};

export type Task = {
  id: string;
  workspaceId: string;
  projectId: string;
  boardId: string;
  listId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: UserLite | null;
  assigneeId?: string | null;
  reporter: UserLite;
  labels: TaskLabel[];
  checklistItems: ChecklistItem[];
  comments: TaskComment[];
  activities: TaskActivity[];
};

export type TaskList = {
  id: string;
  boardId: string;
  name: string;
  status: TaskStatus;
  position: number;
  tasks: Task[];
};

export type Board = {
  id: string;
  projectId: string;
  name: string;
  lists: TaskList[];
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description?: string | null;
  color: string;
  favorite: boolean;
  boards: Board[];
};

export type Presence = {
  id: string;
  userId: string;
  workspaceId: string;
  online: boolean;
  lastSeenAt: string;
  user: UserLite;
};

export type WorkspaceData = {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  ownerId: string;
  members: Member[];
  invites: Invite[];
  projects: Project[];
  activities: TaskActivity[];
  presence: Presence[];
};

export type NotificationItem = {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};
