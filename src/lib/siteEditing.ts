import type { ImageAsset, SiteContent } from "./contentTypes";

export const previewReadyMessage = "kingsvale-preview-ready";
export const previewEditMessage = "kingsvale-preview-edit";
export const previewSelectMessage = "kingsvale-preview-select";
export const previewModeMessage = "kingsvale-preview-mode";
export const previewScrollMessage = "kingsvale-preview-scroll";

export function contentBindings(content: SiteContent) {
  const texts = new Map<string, string[]>();
  const images = new Map<ImageAsset, string>();
  function visit(value: unknown, path: string) {
    if (typeof value === "string" && !/(^|\.)(id|href|src|alt|focalPoint|icon|filename|ctaHref|viewAllHref)$/.test(path) && !path.startsWith("seo.") && !path.includes(".seo.")) {
      texts.set(value, [...(texts.get(value) ?? []), path]);
    } else if (value && typeof value === "object") {
      if ("src" in value && "alt" in value) { images.set(value as ImageAsset, path); return; }
      Object.entries(value).forEach(([key, child]) => visit(child, path ? `${path}.${key}` : key));
    }
  }
  visit(content, "");
  return { texts, images };
}

export function copyKey(text: string, route: string) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${route.replace(/[^a-z0-9-]/gi, "_") || "home"}_${(hash >>> 0).toString(36)}`;
}

export function readField(content: SiteContent, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" && Object.hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined, content);
}

export function applyTextEdit(content: SiteContent, path: string, value: unknown) {
  if (typeof value !== "string" || value.length > 2400) return false;
  if (/^textOverrides\.[a-zA-Z0-9_-]{1,160}$/.test(path)) {
    if (["__proto__", "constructor", "prototype"].includes(path.slice(14))) return false;
    content.textOverrides ??= {};
    if (Object.keys(content.textOverrides).length >= 512 && !Object.hasOwn(content.textOverrides, path.slice(14))) return false;
    content.textOverrides[path.slice(14)] = value;
    return true;
  }
  if (![...contentBindings(content).texts.values()].some((paths) => paths.includes(path))) return false;
  const parts = path.split(".");
  let target = content as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
  target[parts.at(-1)!] = value;
  return true;
}
