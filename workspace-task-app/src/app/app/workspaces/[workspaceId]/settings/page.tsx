import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/workspace-data";
import { SettingsClient } from "@/components/app/SettingsClient";
import type { UserLite, WorkspaceData } from "@/types/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const resolvedParams = await params;
  const user = await requireUser();
  const workspace = await getWorkspaceForUser(resolvedParams.workspaceId, user.id);
  if (!workspace) notFound();

  return (
    <SettingsClient
      user={JSON.parse(JSON.stringify(user)) as UserLite}
      workspace={JSON.parse(JSON.stringify(workspace)) as WorkspaceData}
    />
  );
}
