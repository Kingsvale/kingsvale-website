import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { profileSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const input = profileSchema.parse(await readJson(request));
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        timezone: input.timezone
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarColor: true,
        timezone: true
      }
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return apiError(error);
  }
}
