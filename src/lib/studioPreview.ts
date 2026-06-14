import { normalizeSiteContent } from "./contentNormalize";
import type { SiteContent } from "./contentTypes";

export const studioPreviewParam = "studio-preview";
export const studioPreviewStorageKey = "kingsvale-studio-preview-content-v1";
export const studioPreviewMessageType = "kingsvale-studio-preview-content";

export type StudioPreviewMessage = {
  type: typeof studioPreviewMessageType;
  content: SiteContent;
};

export function buildStudioPreviewUrl(route: string, revision: number) {
  const query = `${studioPreviewParam}=${revision}`;
  return `${route}${route.includes("?") ? "&" : "?"}${query}`;
}

export function isStudioPreviewRequest(search = getSearch()) {
  return new URLSearchParams(search).has(studioPreviewParam);
}

export function saveStudioPreviewContent(content: SiteContent) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(studioPreviewStorageKey, JSON.stringify(content));
}

export function loadStudioPreviewContent() {
  if (typeof window === "undefined" || !isStudioPreviewRequest()) {
    return null;
  }

  return parseStudioPreviewContent(window.sessionStorage.getItem(studioPreviewStorageKey));
}

export function parseStudioPreviewContent(rawContent: string | null) {
  if (!rawContent) {
    return null;
  }

  try {
    return normalizeStudioPreviewContent(JSON.parse(rawContent) as SiteContent);
  } catch {
    return null;
  }
}

export function normalizeStudioPreviewContent(content: SiteContent) {
  return normalizeSiteContent(content);
}

function getSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}
