import type { SiteContent } from "./contentTypes";
import { normalizeSiteContent } from "./contentNormalize";
import { validateSiteContent } from "./contentValidation";

let initialContent: SiteContent | null = null;
export function setInitialContent(content: SiteContent | null) { initialContent = content; }
export function getInitialContent() { return initialContent; }
export function readContentBootstrap(): { content: SiteContent | null } | null {
  if (typeof document === "undefined") return null;
  const element = document.getElementById("kingsvale-content");
  if (!element) return null;
  try {
    const payload = JSON.parse(element.textContent || "null");
    if (payload.content === null) return { content: null };
    const content = normalizeSiteContent(payload.content);
    return validateSiteContent(content).valid ? { content } : null;
  } catch { return null; }
}
