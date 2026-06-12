import type { SiteContent } from "./contentTypes";
import { validateSiteContent } from "./contentValidation";
import { normalizeSiteContent } from "./contentNormalize";

export async function fetchServerContent(): Promise<SiteContent | null> {
  try {
    const response = await fetch("/api/content", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { content?: SiteContent | null };
    if (!payload.content) {
      return null;
    }

    const normalized = normalizeSiteContent(payload.content);
    const validation = validateSiteContent(normalized);
    return validation.valid ? normalized : null;
  } catch {
    return null;
  }
}
