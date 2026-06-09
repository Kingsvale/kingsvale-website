import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-token";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isApp = request.nextUrl.pathname.startsWith("/app");

  if (isApp && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if ((request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register"]
};
