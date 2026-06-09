import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/auth-token";

const oneWeek = 60 * 60 * 24 * 7;

function shouldUseSecureCookies() {
  if (process.env.SECURE_COOKIES === "true") return true;
  if (process.env.SECURE_COOKIES === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarColor: true,
      imageUrl: true,
      timezone: true,
      createdAt: true
    }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function attachSessionCookie(
  response: NextResponse,
  user: { id: string; email: string; name: string }
) {
  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name
  });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    maxAge: oneWeek,
    path: "/"
  });

  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    maxAge: 0,
    path: "/"
  });

  return response;
}
