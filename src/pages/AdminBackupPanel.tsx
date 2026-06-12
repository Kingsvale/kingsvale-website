import { Download, FileArchive, UploadCloud } from "lucide-react";
import { type ChangeEvent, useMemo, useState } from "react";
import { exportFullBackup, importFullBackup, type KingsvaleBackup } from "../lib/cmsApi";

type ImportMode = "replace" | "merge";

export function AdminBackupPanel() {
  const [status, setStatus] = useState("Export a complete Kingsvale backup before major edits.");
  const [busy, setBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [pendingBackup, setPendingBackup] = useState<KingsvaleBackup | null>(null);
  const summary = useMemo(() => summarizeBackup(pendingBackup), [pendingBackup]);

  async function handleExport() {
    setBusy(true);
    setStatus("Preparing backup...");
    try {
      const backup = await exportFullBackup();
      downloadJson(backup);
      setStatus(`Backup exported with ${backup.stores.tracking.sites.length} site records.`);
    } catch {
      setStatus("Backup export failed. Check the server session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as KingsvaleBackup;
      if (parsed.kind !== "kingsvale-full-backup") {
        setStatus("That file is not a Kingsvale full backup.");
        return;
      }
      setPendingBackup(parsed);
      setStatus(`Backup loaded from ${file.name}. Review the summary before importing.`);
    } catch {
      setStatus("Backup file could not be read.");
    }
  }

  async function handleImport() {
    if (!pendingBackup) {
      return;
    }
    setBusy(true);
    setStatus(importMode === "replace" ? "Replacing stored data..." : "Merging stored data...");
    try {
      await importFullBackup(pendingBackup, importMode);
      setStatus("Backup imported. Refresh the Studio panels to review the restored data.");
    } catch {
      setStatus("Backup import failed. The automatic pre-import backup remains on the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="backup-admin" aria-label="Backup and restore">
      <div className="sites-admin__toolbar">
        <div className="admin-status sites-admin__status" role="status">
          <FileArchive aria-hidden="true" />
          <span>{status}</span>
        </div>
        <button type="button" className="admin-save" onClick={handleExport} disabled={busy}>
          <Download aria-hidden="true" />
          Export full backup
        </button>
      </div>

      <div className="backup-grid">
        <section className="admin-panel" aria-labelledby="backup-export-title">
          <h2 id="backup-export-title">What gets exported</h2>
          <ul className="backup-list">
            <li>Published website content, draft content and revision history.</li>
            <li>Sites, QR links, map embeds, private notes, Searchland links and uploaded letters.</li>
            <li>Mailing statuses, reminders, Royal Mail tracking fields and mailing notes.</li>
            <li>Analytics visit records and contact/newsletter lead logs.</li>
          </ul>
        </section>

        <section className="admin-panel" aria-labelledby="backup-import-title">
          <h2 id="backup-import-title">Import backup</h2>
          <label className="backup-drop">
            <UploadCloud aria-hidden="true" />
            <span>Choose Kingsvale backup JSON</span>
            <input className="sr-only" type="file" accept="application/json,.json" onChange={handleFileChange} />
          </label>
          <label className="admin-field" htmlFor="backup-mode">
            <span className="admin-field__label">Import mode</span>
            <select id="backup-mode" value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
              <option value="replace">Replace everything</option>
              <option value="merge">Merge sites, visits and leads</option>
            </select>
          </label>
          {summary && (
            <div className="backup-summary" aria-label="Selected backup summary">
              <span>Exported {summary.exportedAt}</span>
              <strong>{summary.sites} sites</strong>
              <strong>{summary.visits} analytics visits</strong>
              <strong>{summary.leads} lead log lines</strong>
            </div>
          )}
          <button type="button" className="admin-save" onClick={handleImport} disabled={!pendingBackup || busy}>
            Import selected backup
          </button>
        </section>
      </div>
    </section>
  );
}

function summarizeBackup(backup: KingsvaleBackup | null) {
  if (!backup) {
    return null;
  }
  return {
    exportedAt: new Date(backup.exportedAt).toLocaleString(),
    sites: backup.stores.tracking.sites.length,
    visits: Array.isArray((backup.stores.analytics as { visits?: unknown[] }).visits)
      ? (backup.stores.analytics as { visits: unknown[] }).visits.length
      : 0,
    leads: countLines(backup.stores.leads.contact) + countLines(backup.stores.leads.newsletter)
  };
}

function countLines(value: string) {
  return value.split("\n").filter(Boolean).length;
}

function downloadJson(backup: KingsvaleBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kingsvale-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
