import { useEffect, useState } from "react";
import { fetchContactEmailStatus } from "../lib/cmsApi";

export function AdminContactDelivery() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchContactEmailStatus>> | null>(null);
  const [error, setError] = useState("");
  async function refresh() { try { setStatus(await fetchContactEmailStatus()); setError(""); } catch { setError("Email status is available in the deployed Studio. Configure the Google app password in your server environment."); } }
  useEffect(() => { void refresh(); }, []);
  return <section className="admin-subcard" aria-label="Contact email delivery">
    <h3>Website enquiry emails</h3>
    <p>{status?.message || error || "Checking email setup…"}</p>
    {status && <><p>Inbox: <strong>{status.recipient}</strong></p><p>{status.pending} enquiries waiting for email delivery</p><p>Last delivery result: {status.lastStatus ?? "No attempts yet"}</p></>}
    <p>Enquiries are saved on the backend before sending. Failed email deliveries retry automatically.</p>
    <button type="button" className="admin-small" onClick={() => { void refresh(); }}>Refresh email status</button>
  </section>;
}
