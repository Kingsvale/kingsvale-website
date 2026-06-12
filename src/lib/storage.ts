import { defaultContent } from "../data/defaultContent";
import { normalizeSiteContent } from "./contentNormalize";
import type { SiteContent } from "./contentTypes";
import { validateSiteContent } from "./contentValidation";

export const storageKey = "kingsvale-site-content-v1";

export function cloneContent(content: SiteContent): SiteContent {
  return structuredClone(content);
}

export function loadPublishedContent(): SiteContent {
  if (typeof window === "undefined") {
    return cloneContent(defaultContent);
  }

  const rawContent = window.localStorage.getItem(storageKey);
  if (!rawContent) {
    return cloneContent(defaultContent);
  }

  try {
    const parsed = JSON.parse(rawContent) as SiteContent;
    const normalized = normalizeSiteContent(parsed);
    const validation = validateSiteContent(normalized);
    return validation.valid ? normalized : cloneContent(defaultContent);
  } catch {
    return cloneContent(defaultContent);
  }
}

export function savePublishedContent(content: SiteContent): void {
  const validation = validateSiteContent(content);
  if (!validation.valid) {
    throw new Error("Content is invalid and cannot be published.");
  }

  window.localStorage.setItem(storageKey, JSON.stringify(content));
  window.dispatchEvent(new Event("kingsvale-content-updated"));
}

export function resetPublishedContent(): void {
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event("kingsvale-content-updated"));
}
