import { isAnalyticsVisit, type AnalyticsVisit } from "./analytics";

export type AnalyticsRouteSummary = {
  path: string;
  title: string;
  routeType: AnalyticsVisit["routeType"];
  visits: number;
};

export type AnalyticsDaySummary = {
  date: string;
  visits: number;
};

export type AnalyticsSummary = {
  totalVisits: number;
  websiteVisits: number;
  trackingVisits: number;
  todayVisits: number;
  uniqueRoutes: number;
  topRoutes: AnalyticsRouteSummary[];
  dailyVisits: AnalyticsDaySummary[];
  updatedAt: string | null;
};

export function buildAnalyticsSummary(visits: AnalyticsVisit[], updatedAt: string | null = null): AnalyticsSummary {
  const cleanVisits = visits.filter(isAnalyticsVisit).sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  const today = new Date().toISOString().slice(0, 10);
  const routeMap = new Map<string, AnalyticsRouteSummary>();

  for (const visit of cleanVisits) {
    const key = `${visit.routeType}:${visit.path}`;
    const current = routeMap.get(key);
    if (current) {
      current.visits += 1;
    } else {
      routeMap.set(key, {
        path: visit.path,
        title: visit.title,
        routeType: visit.routeType,
        visits: 1
      });
    }
  }

  return {
    totalVisits: cleanVisits.length,
    websiteVisits: cleanVisits.filter((visit) => visit.routeType === "website").length,
    trackingVisits: cleanVisits.filter((visit) => visit.routeType === "tracking").length,
    todayVisits: cleanVisits.filter((visit) => visit.visitedAt.startsWith(today)).length,
    uniqueRoutes: routeMap.size,
    topRoutes: [...routeMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 6),
    dailyVisits: buildDailyVisits(cleanVisits),
    updatedAt
  };
}

function buildDailyVisits(visits: AnalyticsVisit[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });

  return days.map((date) => ({
    date,
    visits: visits.filter((visit) => visit.visitedAt.startsWith(date)).length
  }));
}
