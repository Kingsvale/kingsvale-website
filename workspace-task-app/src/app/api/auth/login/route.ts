import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/strings";
import { loginSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limited = rateLimit(`login:${ip}`, 12, 60_000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "Too many login attempts." }, { status: 429 });
    }

    const input = loginSchema.parse(await readJson(request));
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) }
    });

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name }
    });
    return attachSessionCookie(response, user);
  } catch (error) {
    return apiError(error);
  }
}
