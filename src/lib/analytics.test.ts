import { describe, expect, it } from "vitest";
import {
  analyticsLastVisitKey,
  createVisit,
  shouldRecordAnalyticsVisit
} from "./analytics";
import { buildAnalyticsSummary } from "./analyticsSummary";

describe("analytics", () => {
  it("summarizes website and tracking visits", () => {
    const visits = [
      createVisit({ path: "/", title: "Homepage", routeType: "website" }, "2026-06-12T10:00:00.000Z"),
      createVisit({ path: "/", title: "Homepage", routeType: "website" }, "2026-06-12T10:05:00.000Z"),
      createVisit(
        { path: "/track/token", title: "Customer tracking page", routeType: "tracking" },
        "2026-06-12T10:10:00.000Z"
      )
    ];

    const summary = buildAnalyticsSummary(visits, "2026-06-12T10:15:00.000Z");

    expect(summary.totalVisits).toBe(3);
    expect(summary.websiteVisits).toBe(2);
    expect(summary.trackingVisits).toBe(1);
    expect(summary.uniqueRoutes).toBe(2);
    expect(summary.topRoutes[0]).toMatchObject({ path: "/", visits: 2 });
  });

  it("suppresses immediate duplicate visits for the same route", () => {
    window.sessionStorage.removeItem(analyticsLastVisitKey);

    expect(shouldRecordAnalyticsVisit("/", 1000)).toBe(true);
    expect(shouldRecordAnalyticsVisit("/", 1500)).toBe(false);
    expect(shouldRecordAnalyticsVisit("/about", 1600)).toBe(true);
    expect(shouldRecordAnalyticsVisit("/", 3501)).toBe(true);
  });
});
