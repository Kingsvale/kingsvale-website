import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie } from "@/lib/auth";
import { apiError, isFormRequest, readRequestInput, redirectToPath, redirectWithError, safeNextPath } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/strings";
import { loginSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formRequest = isFormRequest(request);
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limited = rateLimit(`login:${ip}`, 12, 60_000);
    if (!limited.allowed) {
      if (formRequest) {
        return redirectWithError(request, "/login", "Too many login attempts.");
      }
      return NextResponse.json({ error: "Too many login attempts." }, { status: 429 });
    }

    const input = loginSchema.parse(await readRequestInput(request));
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) }
    });

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      if (formRequest) {
        return redirectWithError(request, "/login", "Invalid email or password.");
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const response = formRequest
      ? redirectToPath(request, safeNextPath(request))
      : NextResponse.json({
          user: { id: user.id, email: user.email, name: user.name }
        });
    return attachSessionCookie(response, user);
  } catch (error) {
    if (formRequest) {
      return redirectWithError(request, "/login", "Authentication failed.");
    }
    return apiError(error);
  }
}
