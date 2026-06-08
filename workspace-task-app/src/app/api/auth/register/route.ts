import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { WorkspaceRole, WorkspaceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { defaultBoardCreate } from "@/lib/defaults";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, slugify } from "@/lib/strings";
import { registerSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limited = rateLimit(`register:${ip}`, 8, 60_000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "Too many registration attempts." }, { status: 429 });
    }

    const input = registerSchema.parse(await readJson(request));
    const email = normalizeEmail(input.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const baseSlug = slugify(`${input.name} workspace`) || "workspace";
    const slug = await uniqueWorkspaceSlug(baseSlug);

    const user = await prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash,
        workspaces: undefined
      }
    });

    await prisma.workspace.create({
      data: {
        name: `${input.name.split(" ")[0]}'s Workspace`,
        slug,
        type: WorkspaceType.PERSONAL,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: WorkspaceRole.OWNER
          }
        },
        projects: {
          create: {
            name: "Personal Tasks",
            key: "TASKS",
            description: "Your first private project space.",
            favorite: true,
            boards: {
              create: defaultBoardCreate()
            }
          }
        }
      }
    });

    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
    return attachSessionCookie(response, user);
  } catch (error) {
    return apiError(error);
  }
}

async function uniqueWorkspaceSlug(base: string) {
  let candidate = base;
  let suffix = 1;
  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
