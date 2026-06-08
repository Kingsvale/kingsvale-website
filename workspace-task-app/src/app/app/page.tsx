import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserWorkspaces } from "@/lib/workspace-data";
import { EmptyAppHome } from "@/components/app/EmptyAppHome";

export default async function AppHomePage() {
  const user = await requireUser();
  const workspaces = await getUserWorkspaces(user.id);

  if (workspaces[0]) {
    redirect(`/app/workspaces/${workspaces[0].id}`);
  }

  return <EmptyAppHome userName={user.name} />;
}
