import { ZodError } from "zod";
import { NextResponse } from "next/server";

export async function readJson<T>(request: Request) {
  return (await request.json()) as T;
}

export function isFormRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
}

export async function readRequestInput<T>(request: Request) {
  if (!isFormRequest(request)) {
    return readJson<T>(request);
  }

  const formData = await request.formData();
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, typeof value === "string" ? value : ""])
  ) as T;
}

export function safeNextPath(request: Request, fallback = "/app") {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") || fallback;

  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function urlForPath(request: Request, path: string) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");

  if (origin && /^https?:\/\/[^/]+$/i.test(origin)) {
    return new URL(path, origin);
  }

  if (host) {
    return new URL(path, `${protocol}://${host}`);
  }

  return new URL(path, request.url);
}

export function redirectToPath(request: Request, path: string) {
  return NextResponse.redirect(urlForPath(request, path), { status: 303 });
}

export function redirectWithError(request: Request, path: string, message: string) {
  const url = urlForPath(request, path);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, { status: 303 });
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  if (error instanceof Error && "status" in error) {
    const status = Number((error as Error & { status: number }).status);
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error(error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
