import { useEffect, useState } from "react";
import { ArrowRight, Clock, Eye, Mail, MapPin } from "lucide-react";
import { listTrackingSites } from "../lib/cmsApi";
import { isRemailReminderOverdue } from "../lib/trackingStorage";
import type { TrackingSite } from "../lib/trackingTypes";
import { useEngagement } from "../hooks/useEngagement";
import { ViewBadge } from "./AdminViewStatus";

export function AdminDashboard({ openSite, openArea, unpublished }: { openSite: (id: string, area?: "sites" | "mailing") => void; openArea: (area: "website" | "qr" | "integrations") => void; unpublished: boolean }) {
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [error, setError] = useState("");
  const engagement = useEngagement();
  useEffect(() => { void listTrackingSites().then(setSites).catch(() => setError("Sites could not be loaded. Refresh Studio to retry.")); }, []);
  const active = sites.filter(site => !site.archived);
  const due = active.filter(site => isRemailReminderOverdue(site) && !["responded", "do-not-contact"].includes(site.mailingStatus) && site.contactPriority !== "do-not-contact");
  const ready = active.filter(site => site.mailingStatus === "ready-to-mail");
  const viewed = engagement.data?.sites.filter(site => site.viewed && !site.archived) ?? [];
  const recent = [...viewed].sort((a, b) => (b.lastViewedAt ?? "").localeCompare(a.lastViewedAt ?? "")).slice(0, 5);
  return <section className="studio-dashboard" aria-label="Studio overview">
    <div className="studio-section-title"><div><p className="studio-date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p><h2>Your work at a glance</h2><p>Follow up on correspondence, check QR activity and manage the website.</p></div><button className="admin-save" onClick={() => openArea("website")}>Edit website<ArrowRight aria-hidden="true" /></button></div>
    {error && <p role="alert">{error}</p>}
    <div className="studio-dashboard-metrics">{[{ label: "Active sites", count: active.length, icon: MapPin }, { label: "Viewed externally", count: engagement.data ? viewed.length : "—", icon: Eye }, { label: "Follow-ups due", count: due.length, icon: Clock }, { label: "Ready to mail", count: ready.length, icon: Mail }].map(metric => <article key={metric.label}><metric.icon aria-hidden="true" /><strong>{metric.count}</strong><span>{metric.label}</span></article>)}</div>
    <div className="studio-two-column"><section className="admin-panel"><h3>Next actions</h3>{unpublished && <button className="studio-action-row" onClick={() => openArea("website")}><div><strong>Review website draft</strong><span>Your draft differs from the live website.</span></div><ArrowRight aria-hidden="true" /></button>}{[...due.slice(0, 5).map(site => ({ site, reason: "Follow-up due" })), ...ready.slice(0, 5).map(site => ({ site, reason: "Ready to print and post" }))].map(({ site, reason }) => <button key={`${site.id}-${reason}`} className="studio-action-row" onClick={() => openSite(site.id, "mailing")}><div><strong>{site.reference || site.title}</strong><span>{reason} · {site.title}</span></div><ArrowRight aria-hidden="true" /></button>)}{!due.length && !ready.length && <p>No mailing actions are due. Site notes and posting dates remain available in Mailing.</p>}</section>
    <section className="admin-panel"><div className="studio-section-title"><h3>Recent QR activity</h3><button className="admin-ghost" onClick={() => openArea("qr")}>All QR views</button></div>{recent.map(site => <button key={site.siteId} className="studio-action-row" onClick={() => openSite(site.siteId)}><div><strong>{site.reference || site.title}</strong><span>{site.title} · {site.uniqueNetworks} external networks</span><ViewBadge value={site} /></div><ArrowRight aria-hidden="true" /></button>)}{!recent.length && <p>{engagement.error || "External QR views will appear here. Your Studio and excluded home networks are filtered out."}</p>}</section></div>
    <section className="studio-connection-banner"><div><h3>Ready for a future assistant</h3><p>Create a limited connection when you want an AI to upload photographs or edit content.</p></div><button className="admin-ghost" onClick={() => openArea("integrations")}>Manage AI connections<ArrowRight aria-hidden="true" /></button></section>
  </section>;
}
