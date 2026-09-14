import { CheckCircle2, Mail, RefreshCw, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchContactEmailStatus } from "../lib/cmsApi";
export function AdminContactDelivery() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchContactEmailStatus>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh(verify = false) {
    setBusy(true);
    try { setStatus(await fetchContactEmailStatus(verify)); setError(""); }
    catch { setError("Open Contact in the deployed Studio to check the email server connection."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const verified = status?.connection?.verified;
  const needsAttention = !status?.configured || status?.connection?.verified === false || status?.lastStatus === "failed";
  return <section className="admin-subcard studio-delivery" aria-label="Contact email delivery">
    <div className="studio-delivery__heading"><Mail aria-hidden="true" /><div><p className="eyebrow">Contact form</p><h3>Website enquiry emails</h3></div></div>
    <div className={`studio-delivery__state ${needsAttention ? "studio-delivery__state--pending" : ""}`} role="status">
      {needsAttention ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      <span>{busy ? "Checking connection…" : !status ? "Server connection required" : !status.configured ? "Email setup needed" : verified ? "Email connection verified" : status.connection?.verified === false ? "Connection needs attention" : "Settings saved · connection not checked"}</span>
    </div>
    <p>{error || status?.message || "Checking email setup…"}</p>
    {status && <dl className="studio-delivery__facts"><div><dt>Deliver to</dt><dd>{status.recipient}</dd></div><div><dt>Send from</dt><dd>{status.sender}</dd></div><div><dt>Waiting to send</dt><dd>{status.pending} enquiries</dd></div></dl>}
    <div className="studio-delivery__actions"><button type="button" className="admin-small" disabled={busy || !status?.configured} onClick={() => { void refresh(true); }}>Check email connection</button><button type="button" className="admin-small" disabled={busy} onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Refresh status</button></div>
    <p className="studio-image__hint">Enquiries are saved before sending. Failed deliveries retry automatically. Connection checks do not send a test email.</p>
  </section>;
}
