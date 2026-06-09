import { randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/permissions";
import { normalizeEmail } from "@/lib/strings";
import { inviteSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const params = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await requireWorkspaceRole(user.id, params.workspaceId, WorkspaceRole.ADMIN);
    const input = inviteSchema.parse(await readJson(request));
    const email = normalizeEmail(input.email);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: params.workspaceId,
            userId: existingUser.id
          }
        }
      });

      if (existingMember) {
        return NextResponse.json({ error: "That user is already a workspace member." }, { status: 409 });
      }
    }

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: params.workspaceId,
        email,
        role: input.role,
        token: randomUUID(),
        invitedById: user.id,
        expiresAt: addDays(new Date(), 14)
      }
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.json({
      invite,
      inviteLink: `${appUrl}/invite/${invite.token}`
    });
  } catch (error) {
    return apiError(error);
  }
}
