import { useState } from "react";
import { studioRequest } from "../lib/cmsApi";

type Share = { id: string; expiresAt: string; url?: string };
export function AdminDocumentSharing({ url }: { url: string }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [hours, setHours] = useState(24);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try { setShares((await studioRequest<{ shares: Share[] }>(`document-shares?url=${encodeURIComponent(url)}`)).shares); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not load document links."); }
  }
  async function create() {
    setBusy(true); setLink("");
    try { const result = await studioRequest<{ share: Share }>("document-shares", "POST", { url, hours }); setLink(new URL(result.share.url!, window.location.origin).href); setStatus(`Anyone with this link can open this document until ${new Date(result.share.expiresAt).toLocaleString("en-GB")}.`); await load(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not create a document link."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true);
    try { await studioRequest("document-shares", "DELETE", { id }); setLink(""); setStatus("Access through that link has been revoked."); await load(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not revoke the link."); }
    finally { setBusy(false); }
  }
  return <details className="document-sharing" onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary>Share this document temporarily</summary>
    <p>This file is private. Creating a link lets anyone who receives it view this file until expiry or revocation.</p>
    <label>Link expires after<select value={hours} onChange={event => setHours(Number(event.target.value))}><option value={1}>1 hour</option><option value={24}>24 hours</option><option value={168}>7 days</option></select></label>
    <button type="button" className="admin-open" disabled={busy} onClick={() => void create()}>Create temporary link</button>
    {link && <div><label>Share link<input readOnly value={link} onFocus={event => event.target.select()} /></label><button type="button" className="admin-open" onClick={() => void navigator.clipboard.writeText(link).then(() => setStatus("Link copied.")).catch(() => setStatus("Select and copy the link manually."))}>Copy link</button></div>}
    <p role="status">{status}</p>
    {shares.map(share => <div className="document-sharing__entry" key={share.id}><span>Expires {new Date(share.expiresAt).toLocaleString("en-GB")}</span><button type="button" className="admin-ghost" disabled={busy} onClick={() => void revoke(share.id)}>Revoke link</button></div>)}
  </details>;
}
