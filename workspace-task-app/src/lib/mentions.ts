import type { WorkspacePayload } from "@/lib/workspace-data";

export function mentionedMemberIds(body: string, workspace: Pick<WorkspacePayload, "members">) {
  const handles = new Set(
    Array.from(body.matchAll(/@([a-zA-Z0-9._-]+)/g)).map((match) => match[1].toLowerCase())
  );

  if (handles.size === 0) {
    return [];
  }

  return workspace.members
    .filter((member) => {
      const emailHandle = member.user.email.split("@")[0].toLowerCase();
      const nameHandle = member.user.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return handles.has(emailHandle) || handles.has(nameHandle);
    })
    .map((member) => member.userId);
}
