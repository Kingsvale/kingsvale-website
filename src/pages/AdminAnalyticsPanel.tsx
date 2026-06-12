import { Activity, BarChart3, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAnalyticsSummary } from "../lib/cmsApi";
import type { AnalyticsSummary } from "../lib/analyticsSummary";

export function AdminAnalyticsPanel() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [status, setStatus] = useState("Loading analytics.");
  const [busy, setBusy] = useState(false);

  async function loadSummary() {
    setBusy(true);
    try {
      const next = await fetchAnalyticsSummary();
      setSummary(next);
      setStatus(next.totalVisits ? "Analytics loaded." : "No visits recorded yet.");
    } catch {
      setStatus("Analytics could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadSummary();
    const refresh = () => void loadSummary();
    window.addEventListener("kingsvale-analytics-updated", refresh);
    return () => window.removeEventListener("kingsvale-analytics-updated", refresh);
  }, []);

  const maxDailyVisits = useMemo(
    () => Math.max(1, ...(summary?.dailyVisits.map((day) => day.visits) ?? [0])),
    [summary]
  );

  return (
    <section className="analytics-admin" aria-label="Website analytics">
      <div className="sites-admin__toolbar">
        <div className="admin-status sites-admin__status" role="status">
          <Activity aria-hidden="true" />
          <span>{status}</span>
        </div>
        <button type="button" className="admin-save" onClick={loadSummary} disabled={busy}>
          <RefreshCw aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="analytics-admin__metrics" aria-label="Analytics summary">
        <Metric label="Total visits" value={summary?.totalVisits ?? 0} />
        <Metric label="Website visits" value={summary?.websiteVisits ?? 0} />
        <Metric label="Tracking visits" value={summary?.trackingVisits ?? 0} />
        <Metric label="Today" value={summary?.todayVisits ?? 0} />
      </div>

      <div className="analytics-admin__grid">
        <section className="admin-panel" aria-labelledby="analytics-trend-title">
          <div className="admin-section-heading">
            <h2 id="analytics-trend-title">Last 7 days</h2>
          </div>
          <div className="analytics-bars">
            {(summary?.dailyVisits ?? []).map((day) => (
              <div className="analytics-bars__item" key={day.date}>
                <span>{day.visits}</span>
                <div>
                  <i style={{ height: `${Math.max(8, (day.visits / maxDailyVisits) * 100)}%` }} />
                </div>
                <small>{formatShortDate(day.date)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel" aria-labelledby="analytics-top-title">
          <div className="admin-section-heading">
            <h2 id="analytics-top-title">Top pages</h2>
            <span className="analytics-admin__subtle">{summary?.uniqueRoutes ?? 0} routes</span>
          </div>
          {summary?.topRoutes.length ? (
            <div className="analytics-list">
              {summary.topRoutes.map((route) => (
                <article className="analytics-row" key={`${route.routeType}-${route.path}`}>
                  <BarChart3 aria-hidden="true" />
                  <div>
                    <strong>{route.title}</strong>
                    <span>{route.path}</span>
                  </div>
                  <b>{route.visits}</b>
                </article>
              ))}
            </div>
          ) : (
            <p className="admin-panel__note">Visits will appear here once customers browse the website.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="analytics-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function formatShortDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}
