import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useEngagement } from "../hooks/useEngagement";
import { studioRequest } from "../lib/cmsApi";

import { ViewBadge } from "./AdminViewStatus";

export function AdminEngagementPanel({ onOpenSite }: { onOpenSite?: (id: string) => void }) {
  const { data, error, busy, refresh } = useEngagement();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("Home network");
  const [ip, setIp] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  async function change(method: string, body: unknown) {
    setSaving(true);
    try { await studioRequest("network-exclusions", method, body); setStatus(method === "DELETE" ? "Network exclusion removed." : "Network excluded, including its earlier views."); setIp(""); await refresh(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not save exclusion."); }
    finally { setSaving(false); }
  }
  const visible = (data?.sites ?? []).filter(site => !site.archived && `${site.title} ${site.reference}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "viewed" ? site.viewed : filter === "latest" ? site.viewed && !site.viewedLatestUpdate : !site.viewed)));
  return <section className="studio-engagement" aria-label="QR engagement">
    <div className="studio-section-title"><div><h2>QR page views</h2><p>See which site pages have been opened outside your excluded networks.</p></div><button className="admin-ghost" disabled={busy} onClick={() => void refresh()}><RefreshCw aria-hidden="true" />Refresh views</button></div>
    {error && <p role="alert" className="admin-errors">{error}</p>}
    <div className="studio-filterbar"><label>Search sites<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Reference or site name" /></label><label>Show<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All active sites</option><option value="viewed">Viewed externally</option><option value="unviewed">Not yet viewed</option><option value="latest">Latest update not viewed</option></select></label></div>
    <div className="studio-records">{visible.map(site => <article className="studio-record" key={site.siteId}><div><strong>{site.reference || site.title}</strong><span>{site.title}</span></div><ViewBadge value={site} /><div><strong>{site.uniqueNetworks} {site.uniqueNetworks === 1 ? "network" : "networks"}</strong><span>{site.lastViewedAt ? date(site.lastViewedAt) : "No external view recorded"}</span>{site.viewed && <small>{site.viewedLatestUpdate ? "Latest content viewed" : "Latest content not viewed"}</small>}</div>{onOpenSite && <button className="admin-ghost" onClick={() => onOpenSite(site.siteId)}>Open site</button>}</article>)}</div>
    {data && !visible.length && <p className="admin-note">No sites match this view.</p>}
    <p className="admin-note">IP-based networks, not identified people. IPv6 addresses are grouped by /64. Repeated views within 30 minutes count once unless the page changes. Network history is retained for {data?.settings.retentionDays ?? 180} days after its latest view. Counts begin when this feature is enabled.</p>
    <details className="studio-exclusions"><summary>Your traffic exclusions</summary>
      <p>{data?.settings.currentNetworkExcluded ? "This network is excluded." : "This network has not been excluded."} Signing into Studio automatically excludes that network until you remove it, and marks this browser as an editor for 180 days.</p>
      {data && !data.settings.addressReliable && <p role="alert">Visitor IP detection needs configuration. External views are not counted until the server can identify visitors reliably.</p>}
      <div className="studio-filterbar"><label>Network name<input value={label} maxLength={80} onChange={event => setLabel(event.target.value)} /></label><button className="admin-save" disabled={saving || !data?.settings.addressReliable} onClick={() => void change("POST", { label })}>Exclude this network</button></div>
      <div className="studio-filterbar"><label>Another public IP<input value={ip} onChange={event => setIp(event.target.value)} placeholder="Home or office IPv4 / IPv6" /></label><button className="admin-ghost" disabled={saving || !ip.trim()} onClick={() => void change("POST", { label, ip: ip.trim() })}>Exclude entered IP</button></div>
      <div className="studio-records">{data?.settings.exclusions.map(entry => <div className="studio-record" key={entry.id}><div><strong>{entry.label}</strong><span>{entry.automatic ? "Added on Studio login" : "Added manually"} · {date(entry.createdAt)}</span></div><button className="admin-ghost" disabled={saving} onClick={() => void change("DELETE", { id: entry.id })}>Remove exclusion</button></div>)}</div>
      <p role="status">{status}</p>
    </details>
  </section>;
}
function date(value: string | null) { return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
