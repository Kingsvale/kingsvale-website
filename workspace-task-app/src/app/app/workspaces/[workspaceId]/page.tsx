import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserWorkspaces, getWorkspaceForUser } from "@/lib/workspace-data";
import { WorkspaceClient } from "@/components/app/WorkspaceClient";
import type { UserLite, WorkspaceData, WorkspaceSummary } from "@/types/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const resolvedParams = await params;
  const user = await requireUser();
  const [workspaces, workspace] = await Promise.all([
    getUserWorkspaces(user.id),
    getWorkspaceForUser(resolvedParams.workspaceId, user.id)
  ]);

  if (!workspace) {
    notFound();
  }

  return (
    <WorkspaceClient
      user={JSON.parse(JSON.stringify(user)) as UserLite}
      workspaces={JSON.parse(JSON.stringify(workspaces)) as WorkspaceSummary[]}
      initialWorkspace={JSON.parse(JSON.stringify(workspace)) as WorkspaceData}
    />
  );
}
