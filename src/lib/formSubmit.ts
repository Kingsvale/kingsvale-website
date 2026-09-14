export type SubmitState = "idle" | "submitting" | "success" | "error";
export class FormSubmissionError extends Error {}
export async function postJson(path: string, payload: Record<string, string>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw new FormSubmissionError(response.status === 429 ? "Please wait a moment before trying again. Your message has been kept." : response.status === 400 ? "Please check your details and try again. Your message has been kept." : "We couldn’t submit your enquiry. Your message has been kept—please try again.");
  }
  if (!response.headers.get("content-type")?.includes("application/json") || (await response.json()).ok !== true) throw new FormSubmissionError("We couldn’t confirm your submission. Your message has been kept—please try again.");
}
