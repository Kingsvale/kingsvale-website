import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SiteContent } from "../lib/contentTypes";
import { contentBindings, copyKey, readField } from "../lib/siteEditing";

type ContextValue = { content: SiteContent; bindings: ReturnType<typeof contentBindings>; route: string };
export const SiteEditingContext = createContext<ContextValue | null>(null);

export function SiteContentProvider({ content, route, children }: { content: SiteContent; route: string; children: ReactNode }) {
  const project = content.developments.find((item) => item.ctaHref === route || route === `/developments/${item.id}`);
  if (project) route = `/developments/${project.id}`;
  const bindings = useMemo(() => contentBindings(content), [content]);
  return <SiteEditingContext.Provider value={{ content, bindings, route }}>{children}</SiteEditingContext.Provider>;
}

// Existing CMS fields remain the source of truth. Copy that was hard-coded gets
// a stable key based on its original wording and route, not its DOM position.
export function SiteText({ children, field, copy }: { children: string | number | undefined; field?: string; copy?: string }) {
  const context = useContext(SiteEditingContext);
  const fallback = String(children ?? "");
  let path = field;
  if (!path && context && !copy) {
    const candidates = context.bindings.texts.get(fallback) ?? [];
    const project = context.content.developments.findIndex((item) => context.route === `/developments/${item.id}`);
    path = candidates.find((candidate) => project >= 0 && candidate.startsWith(`developments.${project}.`)) ?? (candidates.length === 1 ? candidates[0] : undefined);
  }
  path ??= `textOverrides.${copy ?? copyKey(fallback, context?.route ?? "/")}`;
  const stored = context ? readField(context.content, path) : undefined;
  return <span data-cms-text={path}>{typeof stored === "string" ? stored : fallback}</span>;
}
