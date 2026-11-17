import { useEffect, useState } from "react";
import { studioRequest } from "../lib/cmsApi";

type IndexingStatus = { enabled: boolean; queued: number; lastSubmittedAt: string | null; lastError: string };
export function AdminSearchIndexing() {
  const [state, setState] = useState<IndexingStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(submit = false) {
    setBusy(true);
    try {
      setState(await studioRequest<IndexingStatus>("search-indexing", submit ? "POST" : "GET"));
      setMessage(submit ? "Published pages queued. Search engines choose when to index them." : "");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not check search notifications."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  return <div className="admin-card">
    <h3>Search notifications</h3>
    <p>The <a href="/sitemap.xml" target="_blank" rel="noreferrer">sitemap</a> updates when you publish. Published pages are automatically sent to IndexNow.</p>
    {state && <p>{!state.enabled ? "Notifications are disabled in this preview." : state.lastSubmittedAt ? `Last accepted: ${new Date(state.lastSubmittedAt).toLocaleString("en-GB")}.` : "No accepted notification yet."} {state.queued > 0 && `${state.queued} pages waiting.`}</p>}
    {state?.lastError && <p role="alert">{state.lastError} The server will retry automatically.</p>}
    <div className="admin-actions"><button type="button" className="admin-open" disabled={busy} onClick={() => void load()}>Refresh status</button><button type="button" className="admin-open" disabled={busy || !state?.enabled} onClick={() => void load(true)}>Notify search engines</button></div>
    <p role="status">{message}</p>
  </div>;
}
