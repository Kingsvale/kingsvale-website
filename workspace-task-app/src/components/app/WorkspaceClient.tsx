"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow, isBefore, parseISO } from "date-fns";
import {
  Archive,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Command,
  LayoutDashboard,
  List,
  Loader2,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Sun,
  UserPlus,
  Users,
  X
} from "lucide-react";
import type { TaskPriority, WorkspaceRole } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useWorkspaceSocket } from "@/hooks/useWorkspaceSocket";
import type {
  Board,
  Member,
  NotificationItem,
  Project,
  Task,
  TaskList,
  UserLite,
  WorkspaceData,
  WorkspaceSummary
} from "@/types/workspace";

type ViewMode = "board" | "list" | "calendar";

type WorkspaceClientProps = {
  user: UserLite;
  workspaces: WorkspaceSummary[];
  initialWorkspace: WorkspaceData;
};

const priorityTone: Record<TaskPriority, "neutral" | "accent" | "warning" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "accent",
  HIGH: "warning",
  URGENT: "danger"
};

const labelColors = ["#5E6AD2", "#38BDF8", "#22C55E", "#F59E0B", "#A855F7", "#F43F5E"];

export function WorkspaceClient({ user, workspaces: initialWorkspaces, initialWorkspace }: WorkspaceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [activeProjectId, setActiveProjectId] = useState(
    searchParams.get("project") || initialWorkspace.projects[0]?.id || ""
  );
  const [view, setView] = useState<ViewMode>("board");
  const [selectedTaskId, setSelectedTaskId] = useState(searchParams.get("task") || "");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");

  const activeProject = useMemo(
    () => workspace.projects.find((project) => project.id === activeProjectId) ?? workspace.projects[0],
    [activeProjectId, workspace.projects]
  );
  const activeBoard = activeProject?.boards[0];
  const activeLists = useMemo(() => activeBoard?.lists ?? [], [activeBoard?.lists]);
  const selectedTask = useMemo(() => activeLists.flatMap((list) => list.tasks).find((task) => task.id === selectedTaskId), [
    activeLists,
    selectedTaskId
  ]);
  const currentMember = workspace.members.find((member) => member.userId === user.id);
  const currentRole = currentMember?.role ?? "VIEWER";
  const canEdit = ["OWNER", "ADMIN", "MEMBER"].includes(currentRole);
  const canAdmin = ["OWNER", "ADMIN"].includes(currentRole);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  const refreshWorkspace = useCallback(async () => {
    const response = await fetch(`/api/workspaces/${workspace.id}`, { cache: "no-store" });
    if (response.ok) {
      const body = await response.json();
      setWorkspace(body.workspace);
      setActiveProjectId((current) => {
        if (body.workspace.projects.some((project: Project) => project.id === current)) return current;
        return body.workspace.projects[0]?.id ?? "";
      });
    }
  }, [workspace.id]);

  const refreshWorkspaces = useCallback(async () => {
    const response = await fetch("/api/workspaces", { cache: "no-store" });
    if (response.ok) {
      const body = await response.json();
      setWorkspaces(body.workspaces);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (response.ok) {
      const body = await response.json();
      setNotifications(body.notifications);
    }
  }, []);

  useWorkspaceSocket(
    workspace.id,
    useCallback(
      (eventName: string) => {
        refreshWorkspace();
        if (eventName === "notification:created") {
          refreshNotifications();
        }
        if (eventName !== "presence:changed") {
          setToast(eventLabel(eventName));
        }
      },
      [refreshNotifications, refreshWorkspace]
    )
  );

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const taskFromUrl = searchParams.get("task");
    if (taskFromUrl) setSelectedTaskId(taskFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (!isTyping && event.key.toLowerCase() === "n" && canEdit) {
        event.preventDefault();
        setTaskModalOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function mutate(url: string, options: RequestInit, successMessage: string) {
    setBusy(successMessage);
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setToast(body.error || "Request failed");
      return body;
    }
    setToast(successMessage);
    await Promise.all([refreshWorkspace(), refreshNotifications(), refreshWorkspaces()]);
    return body;
  }

  async function moveTask(task: Task, list: TaskList) {
    await mutate(
      `/api/workspaces/${workspace.id}/tasks/${task.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ listId: list.id })
      },
      `Moved to ${list.name}`
    );
  }

  return (
    <div className="flex min-h-screen overflow-hidden text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[286px] border-r border-white/[0.06] bg-[#050506]/92 backdrop-blur-2xl transition duration-300 md:relative md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "md:w-[84px]" : "md:w-[286px]"}`}
      >
        <WorkspaceSidebar
          collapsed={sidebarCollapsed}
          currentRole={currentRole}
          user={user}
          workspace={workspace}
          workspaces={workspaces}
          activeProjectId={activeProject?.id ?? ""}
          onProject={(projectId) => {
            setActiveProjectId(projectId);
            setMobileSidebarOpen(false);
          }}
          onCreateWorkspace={() => setWorkspaceModalOpen(true)}
          onCreateProject={() => setProjectModalOpen(true)}
          onInvite={() => setInviteModalOpen(true)}
          onLogout={logout}
          canAdmin={canAdmin}
        />
      </aside>

      {mobileSidebarOpen ? (
        <button className="fixed inset-0 z-30 bg-black/60 md:hidden" aria-label="Close sidebar" onClick={() => setMobileSidebarOpen(false)} />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#050506]/72 px-3 backdrop-blur-2xl sm:px-5">
          <div className="flex h-16 items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label="Open sidebar">
              <Menu className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-left text-sm text-foreground-muted transition hover:bg-white/[0.07]"
            >
              <Search className="h-4 w-4" />
              <span className="truncate">Search tasks, projects, and comments</span>
              <span className="ml-auto hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/45 sm:inline">Ctrl K</span>
            </button>

            <ThemeToggle />
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unreadCount ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(94,106,210,0.8)]" />
                ) : null}
              </Button>
              <NotificationsPanel
                open={notificationsOpen}
                notifications={notifications}
                onClose={() => setNotificationsOpen(false)}
                onReadAll={async () => {
                  await fetch("/api/notifications", { method: "PATCH" });
                  refreshNotifications();
                }}
              />
            </div>
            <Link href="/app/profile" className="hidden sm:block">
              <Avatar name={user.name} email={user.email} color={user.avatarColor} />
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 lg:px-6">
          <section className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                <span className="font-mono uppercase tracking-widest">{workspace.name}</span>
                <span className="text-white/20">/</span>
                <span>{activeProject?.key || "NO PROJECT"}</span>
                <Badge tone={roleTone(currentRole)}>{currentRole}</Badge>
              </div>
              <h1 className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
                {activeProject?.name ?? "Workspace"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                {activeProject?.description || "Create a project to start organizing shared task work."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl value={view} onChange={setView} />
              {canEdit ? (
                <Button variant="primary" onClick={() => setTaskModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New task
                </Button>
              ) : null}
            </div>
          </section>

          <PresenceStrip members={workspace.members} presence={workspace.presence} />

          {!activeProject || !activeBoard ? (
            <EmptyBoard canEdit={canEdit} onCreateProject={() => setProjectModalOpen(true)} />
          ) : view === "board" ? (
            <BoardView lists={activeLists} canEdit={canEdit} onSelect={setSelectedTaskId} onMove={moveTask} />
          ) : view === "list" ? (
            <ListView lists={activeLists} canEdit={canEdit} onSelect={setSelectedTaskId} onMove={moveTask} />
          ) : (
            <CalendarView tasks={activeLists.flatMap((list) => list.tasks)} onSelect={setSelectedTaskId} />
          )}
        </main>
      </div>

      <TaskDrawer
        task={selectedTask}
        workspace={workspace}
        lists={activeLists}
        canEdit={canEdit}
        onClose={() => {
          setSelectedTaskId("");
          router.replace(`/app/workspaces/${workspace.id}`);
        }}
        onPatch={(taskId, payload, message) =>
          mutate(
            `/api/workspaces/${workspace.id}/tasks/${taskId}`,
            { method: "PATCH", body: JSON.stringify(payload) },
            message
          )
        }
        onComment={(taskId, body) =>
          mutate(
            `/api/workspaces/${workspace.id}/tasks/${taskId}/comments`,
            { method: "POST", body: JSON.stringify({ body }) },
            "Comment added"
          )
        }
      />

      <CreateTaskModal
        open={taskModalOpen}
        workspace={workspace}
        project={activeProject}
        board={activeBoard}
        onClose={() => setTaskModalOpen(false)}
        onCreated={async (payload) => {
          await mutate(
            `/api/workspaces/${workspace.id}/tasks`,
            { method: "POST", body: JSON.stringify(payload) },
            "Task created"
          );
          setTaskModalOpen(false);
        }}
      />

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onCreated={async (payload) => {
          const body = await mutate(
            `/api/workspaces/${workspace.id}/projects`,
            { method: "POST", body: JSON.stringify(payload) },
            "Project created"
          );
          if (body.project?.id) setActiveProjectId(body.project.id);
          setProjectModalOpen(false);
        }}
      />

      <WorkspaceModal
        open={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        onCreated={async (payload) => {
          const body = await mutate("/api/workspaces", { method: "POST", body: JSON.stringify(payload) }, "Workspace created");
          if (body.workspace?.id) router.push(`/app/workspaces/${body.workspace.id}`);
        }}
      />

      <InviteModal
        open={inviteModalOpen}
        workspaceId={workspace.id}
        onClose={() => setInviteModalOpen(false)}
        onInvite={async (payload) =>
          mutate(
            `/api/workspaces/${workspace.id}/invites`,
            { method: "POST", body: JSON.stringify(payload) },
            "Invite created"
          )
        }
      />

      <CommandPalette
        open={commandOpen}
        workspaceId={workspace.id}
        onClose={() => setCommandOpen(false)}
        onNewTask={() => {
          setCommandOpen(false);
          setTaskModalOpen(true);
        }}
      />

      {toast || busy ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#0a0a0c]/92 px-4 py-2 text-sm text-foreground shadow-glass backdrop-blur-xl">
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {busy}
            </span>
          ) : (
            toast
          )}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceSidebar({
  collapsed,
  user,
  workspace,
  workspaces,
  activeProjectId,
  currentRole,
  canAdmin,
  onProject,
  onCreateWorkspace,
  onCreateProject,
  onInvite,
  onLogout
}: {
  collapsed: boolean;
  user: UserLite;
  workspace: WorkspaceData;
  workspaces: WorkspaceSummary[];
  activeProjectId: string;
  currentRole: WorkspaceRole;
  canAdmin: boolean;
  onProject: (projectId: string) => void;
  onCreateWorkspace: () => void;
  onCreateProject: () => void;
  onInvite: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] p-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-white shadow-accent">
          TF
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">TaskForge</p>
            <p className="truncate text-xs text-foreground-muted">Live workspace OS</p>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between px-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-muted">Workspaces</p>
            <Button size="icon" variant="ghost" onClick={onCreateWorkspace} aria-label="Create workspace">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1">
            {workspaces.map((item) => (
              <Link
                key={item.id}
                href={`/app/workspaces/${item.id}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                  item.id === workspace.id ? "bg-white/[0.08] text-white" : "text-foreground-muted hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.055] text-[10px] font-semibold">
                  {item.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin">
        <div>
          {!collapsed ? (
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-muted">Project spaces</p>
              <Button size="icon" variant="ghost" onClick={onCreateProject} aria-label="Create project">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
          <div className="space-y-1">
            {workspace.projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onProject(project.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                  project.id === activeProjectId ? "bg-accent/18 text-white" : "text-foreground-muted hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {project.favorite ? <Star className="h-4 w-4 text-indigo-200" /> : <Circle className="h-4 w-4" />}
                {!collapsed ? <span className="truncate">{project.name}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {!collapsed ? (
          <div>
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-muted">Members</p>
              {canAdmin ? (
                <Button size="icon" variant="ghost" onClick={onInvite} aria-label="Invite member">
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
            <div className="space-y-1">
              {workspace.members.slice(0, 8).map((member) => (
                <div key={member.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <PresenceDot member={member} presence={workspace.presence} />
                  <Avatar name={member.user.name} email={member.user.email} color={member.user.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-foreground-muted">{member.user.name}</span>
                  <span className="text-[10px] text-white/35">{member.role}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-3">
        <Link
          href={`/app/workspaces/${workspace.id}/settings`}
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground-muted transition hover:bg-white/[0.05] hover:text-white"
        >
          <Settings className="h-4 w-4" />
          {!collapsed ? <span>Workspace settings</span> : null}
        </Link>
        <Link
          href="/app/profile"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground-muted transition hover:bg-white/[0.05] hover:text-white"
        >
          <Avatar name={user.name} email={user.email} color={user.avatarColor} size="sm" />
          {!collapsed ? <span className="truncate">{user.name}</span> : null}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground-muted transition hover:bg-white/[0.05] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? <span>Log out</span> : null}
        </button>
        {!collapsed ? <p className="px-2 pt-2 text-[11px] text-foreground-muted">Signed in as {currentRole.toLowerCase()}</p> : null}
      </div>
    </div>
  );
}

function SegmentedControl({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  const items = [
    { value: "board" as const, icon: LayoutDashboard, label: "Board" },
    { value: "list" as const, icon: List, label: "List" },
    { value: "calendar" as const, icon: CalendarDays, label: "Calendar" }
  ];

  return (
    <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition ${
              value === item.value ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" : "text-foreground-muted hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PresenceStrip({ members, presence }: { members: Member[]; presence: WorkspaceData["presence"] }) {
  const online = members.filter((member) => presence.some((item) => item.userId === member.userId && item.online));
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs text-foreground-muted">
      <Users className="h-4 w-4 text-indigo-200" />
      <span>{online.length} online</span>
      <span className="text-white/20">/</span>
      <span>{members.length} members</span>
      <div className="ml-1 flex -space-x-2">
        {members.slice(0, 6).map((member) => (
          <Avatar key={member.id} name={member.user.name} email={member.user.email} color={member.user.avatarColor} size="sm" />
        ))}
      </div>
    </div>
  );
}

function BoardView({
  lists,
  canEdit,
  onSelect,
  onMove
}: {
  lists: TaskList[];
  canEdit: boolean;
  onSelect: (taskId: string) => void;
  onMove: (task: Task, list: TaskList) => void;
}) {
  return (
    <div className="grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-6 scrollbar-thin lg:grid-flow-row lg:grid-cols-5">
      {lists.map((list, index) => (
        <section key={list.id} className="glass-panel min-h-[480px] rounded-2xl p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{list.name}</h2>
              <p className="text-xs text-foreground-muted">{list.tasks.length} tasks</p>
            </div>
            <MoreHorizontal className="h-4 w-4 text-white/35" />
          </div>
          <div className="space-y-3">
            {list.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={canEdit}
                previousList={lists[index - 1]}
                nextList={lists[index + 1]}
                onSelect={() => onSelect(task.id)}
                onMove={onMove}
              />
            ))}
            {list.tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-foreground-muted">
                No cards here yet
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  canEdit,
  previousList,
  nextList,
  onSelect,
  onMove
}: {
  task: Task;
  canEdit: boolean;
  previousList?: TaskList;
  nextList?: TaskList;
  onSelect: () => void;
  onMove: (task: Task, list: TaskList) => void;
}) {
  const checklistDone = task.checklistItems.filter((item) => item.completed).length;

  return (
    <article
      onMouseMove={trackSpotlight}
      className="spotlight rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.07] to-white/[0.025] p-3 shadow-[0_1px_14px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-1 hover:border-white/10 hover:shadow-glass-hover"
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold leading-snug tracking-tight">{task.title}</h3>
          <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
        </div>
        {task.description ? <p className="line-clamp-2 text-xs leading-relaxed text-foreground-muted">{task.description}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <span key={label.id} className="rounded-full px-2 py-0.5 text-[10px] text-white" style={{ background: label.color }}>
              {label.name}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-foreground-muted">
          <div className="flex items-center gap-2">
            {task.dueDate ? (
              <span className={isOverdue(task) ? "text-red-200" : ""}>{format(parseISO(task.dueDate), "MMM d")}</span>
            ) : (
              <span>No date</span>
            )}
            {task.checklistItems.length ? (
              <span>
                {checklistDone}/{task.checklistItems.length}
              </span>
            ) : null}
          </div>
          {task.assignee ? <Avatar name={task.assignee.name} email={task.assignee.email} color={task.assignee.avatarColor} size="sm" /> : null}
        </div>
      </button>

      {canEdit ? (
        <div className="mt-3 flex items-center gap-1 border-t border-white/[0.06] pt-2">
          <Button size="icon" variant="ghost" disabled={!previousList} onClick={() => previousList && onMove(task, previousList)} aria-label="Move left">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" disabled={!nextList} onClick={() => nextList && onMove(task, nextList)} aria-label="Move right">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function ListView({
  lists,
  canEdit,
  onSelect,
  onMove
}: {
  lists: TaskList[];
  canEdit: boolean;
  onSelect: (taskId: string) => void;
  onMove: (task: Task, list: TaskList) => void;
}) {
  const tasks = lists.flatMap((list) => list.tasks.map((task) => ({ task, list })));

  return (
    <section className="glass-panel overflow-hidden rounded-2xl">
      <div className="grid grid-cols-[1fr_120px_120px_110px] gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-medium uppercase tracking-widest text-foreground-muted max-md:hidden">
        <span>Task</span>
        <span>Status</span>
        <span>Assignee</span>
        <span>Due</span>
      </div>
      {tasks.map(({ task, list }) => (
        <div
          key={task.id}
          className="grid gap-3 border-b border-white/[0.05] px-4 py-3 transition hover:bg-white/[0.04] md:grid-cols-[1fr_120px_120px_110px]"
        >
          <button type="button" onClick={() => onSelect(task.id)} className="min-w-0 text-left">
            <p className="truncate text-sm font-medium">{task.title}</p>
            <p className="mt-1 truncate text-xs text-foreground-muted">{task.description || "No description"}</p>
          </button>
          <div className="flex items-center gap-2">
            <Badge tone="accent">{list.name}</Badge>
            {canEdit ? (
              <select
                className="h-8 rounded-md border border-white/10 bg-[#0f0f12] px-2 text-xs text-foreground"
                value={list.id}
                onChange={(event) => {
                  const target = lists.find((item) => item.id === event.target.value);
                  if (target) onMove(task, target);
                }}
              >
                {lists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div>{task.assignee ? <Avatar name={task.assignee.name} email={task.assignee.email} color={task.assignee.avatarColor} size="sm" /> : "-"}</div>
          <div className={`text-sm ${isOverdue(task) ? "text-red-200" : "text-foreground-muted"}`}>
            {task.dueDate ? format(parseISO(task.dueDate), "MMM d") : "-"}
          </div>
        </div>
      ))}
    </section>
  );
}

function CalendarView({ tasks, onSelect }: { tasks: Task[]; onSelect: (taskId: string) => void }) {
  const groups = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    return [
      { title: "Overdue", tasks: tasks.filter((task) => task.dueDate && isBefore(parseISO(task.dueDate), now) && !task.completedAt) },
      {
        title: "Next seven days",
        tasks: tasks.filter((task) => task.dueDate && !isBefore(parseISO(task.dueDate), now) && isBefore(parseISO(task.dueDate), nextWeek))
      },
      { title: "Later", tasks: tasks.filter((task) => task.dueDate && !isBefore(parseISO(task.dueDate), nextWeek)) },
      { title: "Unscheduled", tasks: tasks.filter((task) => !task.dueDate) }
    ];
  }, [tasks]);

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {groups.map((group) => (
        <section key={group.title} className="glass-panel min-h-[360px] rounded-2xl p-3">
          <h2 className="mb-3 text-sm font-semibold">{group.title}</h2>
          <div className="space-y-2">
            {group.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelect(task.id)}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.045] p-3 text-left transition hover:bg-white/[0.075]"
              >
                <p className="text-sm font-medium">{task.title}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {task.dueDate ? format(parseISO(task.dueDate), "EEEE, MMM d") : "No due date"}
                </p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskDrawer({
  task,
  workspace,
  lists,
  canEdit,
  onClose,
  onPatch,
  onComment
}: {
  task?: Task;
  workspace: WorkspaceData;
  lists: TaskList[];
  canEdit: boolean;
  onClose: () => void;
  onPatch: (taskId: string, payload: Record<string, unknown>, message: string) => Promise<unknown>;
  onComment: (taskId: string, body: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    assigneeId: "",
    dueDate: "",
    listId: "",
    labels: ""
  });
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!task) return;
    setDraft({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      assigneeId: task.assigneeId || "",
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      listId: task.listId,
      labels: task.labels.map((label) => label.name).join(", ")
    });
  }, [task]);

  if (!task) return null;
  const currentTask = task;

  async function saveTask() {
    await onPatch(
      currentTask.id,
      {
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        assigneeId: draft.assigneeId || null,
        dueDate: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00`).toISOString() : null,
        listId: draft.listId,
        labels: parseLabels(draft.labels)
      },
      "Task updated"
    );
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) return;
    await onComment(currentTask.id, comment.trim());
    setComment("");
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-white/[0.06] bg-[#050506]/94 shadow-[0_0_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-muted">Task detail</p>
          <h2 className="truncate text-lg font-semibold tracking-tight">{task.title}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close task">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Title</Label>
            <Input value={draft.title} disabled={!canEdit} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              disabled={!canEdit}
              className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm"
              value={draft.listId}
              onChange={(event) => setDraft((current) => ({ ...current, listId: event.target.value }))}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select
              disabled={!canEdit}
              className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm"
              value={draft.priority}
              onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}
            >
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <select
              disabled={!canEdit}
              className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm"
              value={draft.assigneeId}
              onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {workspace.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" disabled={!canEdit} value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Labels</Label>
            <Input disabled={!canEdit} value={draft.labels} onChange={(event) => setDraft((current) => ({ ...current, labels: event.target.value }))} placeholder="Design, Beta, Blocked" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea disabled={!canEdit} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <Button variant="primary" onClick={saveTask}>
                <Check className="h-4 w-4" />
                Save changes
              </Button>
              <Button variant="danger" onClick={() => onPatch(task.id, { archived: true }, "Task archived")}>
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            </>
          ) : null}
        </div>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
          <h3 className="mb-3 text-sm font-semibold">Checklist</h3>
          <div className="space-y-2">
            {task.checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm text-foreground-muted">
                <span className={`grid h-4 w-4 place-items-center rounded border ${item.completed ? "border-emerald-400 bg-emerald-400/20" : "border-white/15"}`}>
                  {item.completed ? <Check className="h-3 w-3 text-emerald-100" /> : null}
                </span>
                {item.title}
              </div>
            ))}
            {task.checklistItems.length === 0 ? <p className="text-sm text-foreground-muted">No checklist items yet.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
          <h3 className="mb-3 text-sm font-semibold">Comments</h3>
          <div className="mb-4 space-y-3">
            {task.comments.map((item) => (
              <div key={item.id} className="flex gap-3">
                <Avatar name={item.author.name} email={item.author.email} color={item.author.avatarColor} size="sm" />
                <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-3 py-2">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{item.author.name}</span>
                    <span className="text-foreground-muted">{formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          {canEdit ? (
            <form onSubmit={addComment} className="flex gap-2">
              <Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comment with @name mentions" />
              <Button type="submit" variant="primary" size="icon" aria-label="Send comment">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
          <h3 className="mb-3 text-sm font-semibold">Activity</h3>
          <div className="space-y-3">
            {task.activities.map((activity) => (
              <div key={activity.id} className="text-sm text-foreground-muted">
                <p>{activity.message}</p>
                <p className="text-xs text-white/35">{formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function CreateTaskModal({
  open,
  workspace,
  project,
  board,
  onClose,
  onCreated
}: {
  open: boolean;
  workspace: WorkspaceData;
  project?: Project;
  board?: Board;
  onClose: () => void;
  onCreated: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const defaultList = board?.lists.find((list) => list.name === "To Do") ?? board?.lists[0];
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    assigneeId: "",
    dueDate: "",
    listId: defaultList?.id ?? "",
    labels: ""
  });

  useEffect(() => {
    setForm((current) => ({ ...current, listId: defaultList?.id ?? "" }));
  }, [defaultList?.id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !board || !form.listId) return;
    await onCreated({
      projectId: project.id,
      boardId: board.id,
      listId: form.listId,
      title: form.title,
      description: form.description,
      priority: form.priority,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
      labels: parseLabels(form.labels)
    });
    setForm({ title: "", description: "", priority: "MEDIUM", assigneeId: "", dueDate: "", listId: defaultList?.id ?? "", labels: "" });
  }

  return (
    <Modal open={open} title="Create task" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input required minLength={2} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>List</Label>
            <select className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm" value={form.listId} onChange={(event) => setForm((current) => ({ ...current, listId: event.target.value }))}>
              {board?.lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <select className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm" value={form.assigneeId} onChange={(event) => setForm((current) => ({ ...current, assigneeId: event.target.value }))}>
              <option value="">Unassigned</option>
              {workspace.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Labels</Label>
          <Input value={form.labels} onChange={(event) => setForm((current) => ({ ...current, labels: event.target.value }))} placeholder="Design, Backend" />
        </div>
        <Button variant="primary" type="submit">
          <Plus className="h-4 w-4" />
          Create task
        </Button>
      </form>
    </Modal>
  );
}

function ProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [favorite, setFavorite] = useState(true);
  return (
    <Modal open={open} title="Create project" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await onCreated({ name, description, favorite });
          setName("");
          setDescription("");
        }}
      >
        <div className="space-y-2">
          <Label>Name</Label>
          <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Growth experiments" />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
          Pin this project in the sidebar
        </label>
        <Button variant="primary" type="submit">
          <Plus className="h-4 w-4" />
          Create project
        </Button>
      </form>
    </Modal>
  );
}

function WorkspaceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState("");
  return (
    <Modal open={open} title="Create workspace" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await onCreated({ name, type: "SHARED" });
          setName("");
        }}
      >
        <div className="space-y-2">
          <Label>Name</Label>
          <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Design Ops" />
        </div>
        <Button variant="primary" type="submit">
          <Plus className="h-4 w-4" />
          Create workspace
        </Button>
      </form>
    </Modal>
  );
}

function InviteModal({
  open,
  workspaceId,
  onClose,
  onInvite
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onInvite: (payload: Record<string, unknown>) => Promise<{ inviteLink?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [link, setLink] = useState("");

  return (
    <Modal open={open} title="Invite member" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const body = await onInvite({ email, role });
          if (body.inviteLink) setLink(body.inviteLink);
        }}
      >
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <select className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
            {["ADMIN", "MEMBER", "VIEWER"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <Button variant="primary" type="submit">
          <UserPlus className="h-4 w-4" />
          Create invite
        </Button>
        {link ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="mb-2 text-xs text-foreground-muted">Invite link</p>
            <code className="block break-all text-xs text-indigo-100">{link}</code>
          </div>
        ) : (
          <p className="text-xs text-foreground-muted">The invite will be tied to this workspace: {workspaceId}</p>
        )}
      </form>
    </Modal>
  );
}

function CommandPalette({
  open,
  workspaceId,
  onClose,
  onNewTask
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onNewTask: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; type: string; title: string; subtitle?: string; href: string }>>([]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&workspaceId=${workspaceId}`, { signal: controller.signal });
      if (response.ok) {
        const body = await response.json();
        setResults(body.results);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query, workspaceId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-xl" onClick={onClose}>
      <div className="glass-panel mx-auto mt-20 w-full max-w-2xl overflow-hidden rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <Command className="h-4 w-4 text-indigo-200" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or run a command"
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
          />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close command palette">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2 scrollbar-thin">
          <button type="button" onClick={onNewTask} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-white/[0.06]">
            <Plus className="h-4 w-4 text-indigo-200" />
            <span>New task</span>
          </button>
          {results.map((result) => (
            <Link key={`${result.type}-${result.id}`} href={result.href} onClick={onClose} className="block rounded-xl px-3 py-3 text-sm transition hover:bg-white/[0.06]">
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{result.type}</Badge>
                <span className="font-medium">{result.title}</span>
              </div>
              {result.subtitle ? <p className="mt-1 line-clamp-1 text-xs text-foreground-muted">{result.subtitle}</p> : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsPanel({
  open,
  notifications,
  onClose,
  onReadAll
}: {
  open: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onReadAll: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute right-0 top-12 z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.06] bg-[#0a0a0c]/96 p-3 shadow-glass backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onReadAll}>
            Mark read
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close notifications">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="max-h-[430px] space-y-2 overflow-y-auto scrollbar-thin">
        {notifications.map((notification) => (
          <Link
            key={notification.id}
            href={notification.link || "#"}
            className={`block rounded-xl border px-3 py-2 text-sm transition hover:bg-white/[0.06] ${
              notification.readAt ? "border-white/[0.05] bg-white/[0.025]" : "border-accent/25 bg-accent/12"
            }`}
          >
            <p className="font-medium">{notification.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground-muted">{notification.body}</p>
            <p className="mt-2 text-[11px] text-white/35">{formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}</p>
          </Link>
        ))}
        {notifications.length === 0 ? <p className="rounded-xl bg-white/[0.04] px-3 py-8 text-center text-sm text-foreground-muted">No notifications yet.</p> : null}
      </div>
    </div>
  );
}

function EmptyBoard({ canEdit, onCreateProject }: { canEdit: boolean; onCreateProject: () => void }) {
  return (
    <section className="glass-panel spotlight rounded-2xl p-8 text-center">
      <Sparkles className="mx-auto mb-4 h-8 w-8 text-indigo-200" />
      <h2 className="text-xl font-semibold">No project spaces yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">Create a project to get a board with Backlog, To Do, In Progress, Review, and Done lists.</p>
      {canEdit ? (
        <Button className="mt-5" variant="primary" onClick={onCreateProject}>
          <Plus className="h-4 w-4" />
          Create project
        </Button>
      ) : null}
    </section>
  );
}

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem("taskforge-theme");
    const shouldLight = stored === "light";
    setLight(shouldLight);
    document.documentElement.classList.toggle("light", shouldLight);
    document.documentElement.classList.toggle("dark", !shouldLight);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        const next = !light;
        setLight(next);
        window.localStorage.setItem("taskforge-theme", next ? "light" : "dark");
        document.documentElement.classList.toggle("light", next);
        document.documentElement.classList.toggle("dark", !next);
      }}
      aria-label="Toggle theme"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

function PresenceDot({ member, presence }: { member: Member; presence: WorkspaceData["presence"] }) {
  const online = presence.some((item) => item.userId === member.userId && item.online);
  return <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" : "bg-white/20"}`} />;
}

function roleTone(role: WorkspaceRole): "neutral" | "accent" | "success" | "warning" {
  if (role === "OWNER") return "warning";
  if (role === "ADMIN") return "accent";
  if (role === "MEMBER") return "success";
  return "neutral";
}

function isOverdue(task: Task) {
  return Boolean(task.dueDate && !task.completedAt && isBefore(parseISO(task.dueDate), new Date()));
}

function parseLabels(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((name, index) => ({
      name,
      color: labelColors[index % labelColors.length]
    }));
}

function eventLabel(eventName: string) {
  const labels: Record<string, string> = {
    "task:created": "A task was created",
    "task:updated": "A task was updated",
    "task:moved": "A task moved",
    "task:commented": "New task comment",
    "task:archived": "A task was archived",
    "project:created": "Project created",
    "workspace:updated": "Workspace updated",
    "member:joined": "A member joined",
    "notification:created": "New notification"
  };
  return labels[eventName] || "Workspace updated";
}

function trackSpotlight(event: React.MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
}
