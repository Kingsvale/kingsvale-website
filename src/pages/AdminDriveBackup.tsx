import { useEffect, useState } from "react";
import { driveBackupRequest } from "../lib/cmsApi";

type DriveStatus = {
  configured: boolean; encryptionAvailable: boolean; connected: boolean; enabled: boolean;
  account: string; clientId: string; redirectUri: string; budgetGb: number; folderUrl: string | null;
  busy: boolean; phase: string; lastSuccess: string | null; lastAttempt: string | null;
  lastError: string | null; warning: string | null; retainedBytes: number; driveFreeBytes: number | null;
  history: { id: string; name: string; size: number; createdAt: string }[];
};
const size = (bytes: number) => bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;
const date = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export function AdminDriveBackup() {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [budgetGb, setBudgetGb] = useState(3);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(() => new URLSearchParams(location.search).get("drive") === "failed" ? "Google connection did not complete. Check your client details and redirect address, then connect again using info@kingsvalehomes.co.uk." : "");
  useEffect(() => {
    let cancelled = false;
    void driveBackupRequest<DriveStatus>().then((result) => {
      if (cancelled) return;
      setStatus(result); setClientId(result.clientId); setBudgetGb(result.budgetGb);
    }).catch((error: Error) => { if (!cancelled) setNotice(error.message); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!status?.connected) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void driveBackupRequest<DriveStatus>().then((result) => { if (!cancelled) setStatus(result); }).catch((error: Error) => { if (!cancelled) setNotice(error.message); });
    }, status.busy ? 5000 : 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [status?.busy, status?.connected]);
  async function action(path: string, method = "POST", body?: unknown) {
    setPending(true); setNotice("");
    try {
      const result = await driveBackupRequest<DriveStatus & { url?: string }>(path, method, body);
      if (result.url) { window.location.assign(result.url); return; }
      setStatus(result);
      if (method === "PUT") { setClientSecret(""); setNotice("Google Drive backup settings saved on your server."); }
      if (path === "/disconnect") setNotice("Automatic backups disconnected. Your existing files remain in Google Drive.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Please try again."); }
    finally { setPending(false); }
  }
  const busy = pending || status?.busy;
  const save = (enabled = status?.enabled ?? false) => action("", "PUT", { clientId, clientSecret, budgetGb, enabled });
  return (
    <section className="admin-panel drive-backup" aria-labelledby="drive-backup-title">
      <div className="drive-backup__heading">
        <div><p className="eyebrow">Automatic protection</p><h2 id="drive-backup-title">Daily Google Drive backups</h2></div>
        <span className="drive-backup__badge">{status?.busy ? "Backup in progress" : status?.connected ? status.enabled ? "Daily backups on" : "Schedule paused" : "Not connected"}</span>
      </div>
      <p className="backup-intro">A complete copy of your saved website, photographs, documents and Studio records, every day at 03:00 UK time. The server runs backups even when Studio is closed and catches up after a restart.</p>
      {notice && <p className="drive-backup__notice" role="status">{notice}</p>}
      {status?.lastError && <p className="drive-backup__notice drive-backup__notice--error" role="alert">{status.lastError}</p>}
      {status?.warning && <p className="backup-intro" role="status">{status.warning}</p>}
      {status?.connected && <>
        <dl className="drive-backup__metrics">
          <div><dt>Google account</dt><dd>{status.account}</dd></div>
          <div><dt>Last verified backup</dt><dd>{status.lastSuccess ? date(status.lastSuccess) : "Waiting for first backup"}</dd></div>
          <div><dt>Retained backups</dt><dd>{size(status.retainedBytes)} / {status.budgetGb} GB</dd></div>
          <div><dt>Google storage available</dt><dd>{status.driveFreeBytes === null ? "Reported after next check" : `${size(status.driveFreeBytes)} at last check`}</dd></div>
        </dl>
        <div className="drive-backup__actions">
          <button className="admin-save" type="button" disabled={busy} onClick={() => void action("/run")}>{status.busy ? status.phase : "Back up now"}</button>
          <button className="admin-ghost" type="button" disabled={busy} onClick={() => void action("", "PUT", { enabled: !status.enabled })}>{status.enabled ? "Pause daily backups" : "Resume daily backups"}</button>
          {status.folderUrl && <a className="admin-ghost" href={status.folderUrl} target="_blank" rel="noreferrer">Open backup folder</a>}
        </div>
      </>}
      <div className="drive-backup__retention">
        <strong>Small storage footprint, useful recovery history</strong>
        <p>Up to 7 daily, 4 weekly and 2 monthly restore points, with overlapping dates counted once. Compression reduces file size; older points are removed if the storage budget is reached. Your newest verified backup is kept.</p>
        <p>Cleanup only touches backups created by this installation, after a replacement has been verified. Old backups are permanently deleted to free space. Uploads temporarily need room for one extra copy; 500 MB of Google storage is left as headroom.</p>
      </div>
      {status && <details className="drive-backup__setup" open={!status.configured}>
        <summary>{status.configured ? "Google connection and storage settings" : "Set up Google Drive — one time"}</summary>
        <ol className="backup-list">
          <li>Sign in to <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a> as <strong>info@kingsvalehomes.co.uk</strong>. Create a project under your Workspace organisation and enable the <strong>Google Drive API</strong>.</li>
          <li>Open <strong>Google Auth Platform</strong>. Set the audience to <strong>Internal</strong>, add your business details, and add the scope <code>https://www.googleapis.com/auth/drive.file</code>. This limits access to files created or opened through this app.</li>
          <li>Create an OAuth client with type <strong>Web application</strong>. Add this exact <strong>authorised redirect URI</strong>:<code className="drive-backup__uri">{status.redirectUri}</code></li>
          <li>Paste the client ID and secret below, save, then connect Google Drive. Use the main <strong>info</strong> mailbox. A Gmail app password is not used for Drive.</li>
        </ol>
        <p className="backup-intro">If Internal is unavailable, ask your Workspace administrator to create the project in your organisation. An External app left in Testing can lose background access after seven days.</p>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={busy || !status.encryptionAvailable}>
            <label className="admin-field"><span className="admin-field__label">Google OAuth client ID</span><input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" required placeholder="…apps.googleusercontent.com" /></label>
            <label className="admin-field"><span className="admin-field__label">Google OAuth client secret</span><input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" required={!status.configured} placeholder={status.configured ? "Saved securely — leave blank to keep" : "Paste client secret"} /></label>
            <label className="admin-field"><span className="admin-field__label">Maximum retained backup storage</span><select value={budgetGb} onChange={(event) => setBudgetGb(Number(event.target.value))}><option value={1}>1 GB — smallest footprint</option><option value={2}>2 GB</option><option value={3}>3 GB — recommended for your 30 GB account</option><option value={5}>5 GB — more recovery history</option></select></label>
            <p className="backup-intro">The connection is encrypted in the persistent server data volume and survives deployments. Google credentials are excluded from exported backups. Save any website or site edits before running a backup.</p>
            <button className="admin-save" type="submit">Save Google setup</button>
          </fieldset>
        </form>
        {!status.encryptionAvailable && <p role="alert">The server needs CMS_ENCRYPTION_KEY before it can safely store Google credentials.</p>}
        {status.connected && <button className="admin-ghost" type="button" disabled={busy} onClick={() => void action("/disconnect")}>Disconnect automatic backups</button>}
      </details>}
      {status?.configured && <div className="drive-backup__actions"><button className="admin-ghost" type="button" disabled={busy} onClick={() => void action("/connect")}>{status.connected ? "Renew Google connection" : "Connect Google Drive"}</button></div>}
      {Boolean(status?.history.length) && <details className="drive-backup__setup"><summary>Recent restore points ({status?.history.length})</summary>
        <p>Open a backup in Drive, download the .json.gz file, then choose it in Import backup below. Studio opens compressed files directly. Each archive restores independently.</p>
        <ul className="drive-backup__history">{status?.history.map((item) => <li key={item.id}><a href={`https://drive.google.com/file/d/${encodeURIComponent(item.id)}/view`} target="_blank" rel="noreferrer">{date(item.createdAt)}</a><span>{size(item.size)}</span></li>)}</ul>
      </details>}
    </section>
  );
}
