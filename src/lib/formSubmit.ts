export type SubmitState = "idle" | "submitting" | "success" | "error";

export async function postJson(path: string, payload: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Submission failed.");
  }
}
