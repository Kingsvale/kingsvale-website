export type AnalyticsRouteType = "website" | "tracking";

export type AnalyticsVisitInput = {
  path: string;
  title: string;
  routeType: AnalyticsRouteType;
};

export type AnalyticsVisit = AnalyticsVisitInput & {
  id: string;
  visitedAt: string;
};

export const analyticsStorageKey = "kingsvale-analytics-visits-v1";
export const analyticsLastVisitKey = "kingsvale-analytics-last-visit-v1";

const maxLocalVisits = 500;
const duplicateWindowMs = 2_000;

export function shouldTrackRoute(path: string) {
  return (
    path !== "/admin" &&
    !path.startsWith("/studio") &&
    !path.startsWith("/api/") &&
    !path.startsWith("/assets/")
  );
}

export function shouldRecordAnalyticsVisit(path: string, now = Date.now()) {
  if (typeof window === "undefined") {
    return true;
  }

  const clean = cleanPath(path);
  try {
    const last = JSON.parse(window.sessionStorage.getItem(analyticsLastVisitKey) ?? "null") as {
      path?: string;
      recordedAt?: number;
    } | null;

    if (last?.path === clean && typeof last.recordedAt === "number" && now - last.recordedAt < duplicateWindowMs) {
      return false;
    }

    window.sessionStorage.setItem(
      analyticsLastVisitKey,
      JSON.stringify({ path: clean, recordedAt: now })
    );
    return true;
  } catch {
    return true;
  }
}

export function createVisit(input: AnalyticsVisitInput, visitedAt = new Date().toISOString()): AnalyticsVisit {
  return {
    ...input,
    path: cleanPath(input.path),
    title: input.title.trim().slice(0, 120) || "Untitled page",
    id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    visitedAt
  };
}

export function recordLocalVisit(input: AnalyticsVisitInput) {
  const visits = loadLocalAnalyticsVisits();
  const next = [createVisit(input), ...visits].slice(0, maxLocalVisits);
  saveLocalAnalyticsVisits(next);
  return next[0];
}

export async function recordAnalyticsVisit(input: AnalyticsVisitInput) {
  try {
    const response = await fetch("/api/analytics/visit", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visit: input })
    });

    if (!response.ok) {
      recordLocalVisit(input);
    }
  } catch {
    recordLocalVisit(input);
  }
}

export function loadLocalAnalyticsVisits(): AnalyticsVisit[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(analyticsStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as AnalyticsVisit[];
    return Array.isArray(parsed) ? parsed.filter(isAnalyticsVisit) : [];
  } catch {
    return [];
  }
}

function saveLocalAnalyticsVisits(visits: AnalyticsVisit[]) {
  window.localStorage.setItem(analyticsStorageKey, JSON.stringify(visits));
  window.dispatchEvent(new Event("kingsvale-analytics-updated"));
}

export function isAnalyticsVisit(value: unknown): value is AnalyticsVisit {
  const visit = value as Partial<AnalyticsVisit> | null;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof visit?.id === "string" &&
    typeof visit.path === "string" &&
    typeof visit.title === "string" &&
    (visit.routeType === "website" || visit.routeType === "tracking") &&
    typeof visit.visitedAt === "string"
  );
}

function cleanPath(path: string) {
  const trimmed = path.trim() || "/";
  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
}
