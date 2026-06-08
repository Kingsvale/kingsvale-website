import { ZodError } from "zod";
import { NextResponse } from "next/server";

export async function readJson<T>(request: Request) {
  return (await request.json()) as T;
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
