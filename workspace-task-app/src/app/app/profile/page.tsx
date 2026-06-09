import { requireUser } from "@/lib/auth";
import { ProfileClient } from "@/components/app/ProfileClient";
import type { UserLite } from "@/types/workspace";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  return <ProfileClient user={JSON.parse(JSON.stringify(user)) as UserLite} />;
}
