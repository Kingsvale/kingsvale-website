import { useEffect, useState } from "react";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { listTrackingSites, studioRequest } from "../lib/cmsApi";
import type { TrackingSite } from "../lib/trackingTypes";

type Integration = { id: string; name: string; scopes: string[]; siteIds: string[]; createdAt: string; expiresAt: string; revokedAt: string | null };
const permissions = [{ id: "website:read", name: "Read website content" }, { id: "website:draft:write", name: "Edit website drafts" }, { id: "media:upload", name: "Upload photographs" }, { id: "sites:read", name: "Read selected site records, including private details" }, { id: "sites:write", name: "Update selected sites and their live QR pages" }];
const readRequired: Record<string, string> = { "website:draft:write": "website:read", "sites:write": "sites:read" };
export function AdminIntegrationsPanel() {
  const [keys, setKeys] = useState<Integration[]>([]);
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["website:read", "website:draft:write", "media:upload"]);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [days, setDays] = useState(30);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() { try { const result = await studioRequest<{ keys: Integration[] }>("integrations"); setKeys(result.keys); } catch (error) { setStatus(error instanceof Error ? error.message : "Connections unavailable."); } }
  useEffect(() => { void load(); void listTrackingSites().then(setSites).catch(() => {}); }, []);
  async function create() {
    setBusy(true); setToken("");
    try { const result = await studioRequest<{ token: string }>("integrations", "POST", { name, scopes, siteIds, expiresInDays: days }); setToken(result.token); setName(""); setStatus("Connection created. Copy the key now; it is shown only once."); await load(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not create connection."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) { setBusy(true); try { await studioRequest("integrations", "DELETE", { id }); setToken(""); setStatus("Connection revoked."); await load(); } catch (error) { setStatus(error instanceof Error ? error.message : "Could not revoke connection."); } finally { setBusy(false); } }
  return <section className="studio-integrations" aria-label="AI connections">
    <div className="studio-section-title"><div><h2>AI & integrations</h2><p>Connect an assistant or script with its own permissions and expiry.</p></div><button className="admin-ghost" onClick={() => void load()}><RefreshCw aria-hidden="true" />Refresh connections</button></div>
    <div className="studio-two-column"><section className="admin-panel"><h3>Create a connection</h3>
      <label className="admin-field"><span>Connection name</span><input value={name} maxLength={80} placeholder="Website assistant" onChange={event => setName(event.target.value)} /></label>
      <fieldset className="studio-permissions"><legend>Allow this connection to</legend>{permissions.map(permission => <label key={permission.id}><input type="checkbox" checked={scopes.includes(permission.id)} disabled={Boolean(readRequired[permission.id] && !scopes.includes(readRequired[permission.id]))} onChange={event => setScopes(current => event.target.checked ? [...current, permission.id] : current.filter(id => id !== permission.id && readRequired[id] !== permission.id))} />{permission.name}</label>)}</fieldset>
      <p className="admin-note">To allow editing, enable the matching read permission first.</p>
      {scopes.some(scope => scope.startsWith("sites:")) && <fieldset className="studio-permissions"><legend>Accessible sites</legend>{sites.map(site => <label key={site.id}><input type="checkbox" checked={siteIds.includes(site.id)} onChange={event => setSiteIds(current => event.target.checked ? [...current, site.id] : current.filter(id => id !== site.id))} />{site.reference} · {site.title}</label>)}</fieldset>}
      <label className="admin-field"><span>Expires after</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
      <button className="admin-save" disabled={busy || !name.trim() || !scopes.length || (scopes.some(scope => scope.startsWith("sites:")) && !siteIds.length)} onClick={() => void create()}><KeyRound aria-hidden="true" />Create access key</button>
      <p role="status">{status}</p>
      {token && <div className="studio-key-reveal"><label>Copy this key once<textarea readOnly value={token} spellCheck={false} /></label><button className="admin-ghost" onClick={() => void navigator.clipboard.writeText(token).then(() => setStatus("Access key copied.")).catch(() => setStatus("Select the key and copy it manually."))}><Copy aria-hidden="true" />Copy key</button><button className="admin-ghost" onClick={() => setToken("")}>Hide key</button></div>}
    </section><section className="admin-panel"><h3>How the relay works</h3><p>Website changes arrive as drafts. Review them in Website, then publish when ready. Site write access changes the selected QR pages immediately.</p><p>Keys cannot publish the website, change settings, read backups, send mail or run code.</p><dl className="studio-api-details"><dt>API base</dt><dd><code>{window.location.origin}/api/relay/v1</code></dd><dt>Authentication</dt><dd><code>Authorization: Bearer YOUR_KEY</code></dd><dt>Safe editing</dt><dd>Read the current record, then send its ETag in an If-Match header. Conflicting changes are rejected.</dd></dl><a className="admin-ghost" href="/studio-relay-guide.md" target="_blank" rel="noreferrer">Open connection guide</a></section></div>
    <h3>Connections</h3><div className="studio-records">{keys.map(key => <article className="studio-record" key={key.id}><div><strong>{key.name}</strong><span>{key.scopes.join(" · ")}</span><small>{key.revokedAt ? "Revoked" : Date.parse(key.expiresAt) < Date.now() ? "Expired" : `Expires ${new Date(key.expiresAt).toLocaleDateString("en-GB")}`}</small></div>{!key.revokedAt && <button className="admin-ghost" disabled={busy} onClick={() => void revoke(key.id)}>Revoke access</button>}</article>)}</div>{!keys.length && <p>No connections have been created.</p>}
  </section>;
}
