import { Download, FileArchive, UploadCloud } from "lucide-react";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { exportFullBackup, importFullBackup, type KingsvaleBackup } from "../lib/cmsApi";
import { parseBackup } from "../lib/backupValidation";

type ImportMode = "replace" | "merge";

export function AdminBackupPanel({ onImported }: { onImported?: () => void | Promise<void> }) {
  const [status, setStatus] = useState("Save your website draft before exporting. Full backups include uploaded photographs and documents.");
  const [busy, setBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [pendingBackup, setPendingBackup] = useState<KingsvaleBackup | null>(null);
  const fileSelection = useRef(0);
  const summary = useMemo(() => summarizeBackup(pendingBackup), [pendingBackup]);

  async function handleExport() {
    setBusy(true);
    setStatus("Preparing backup...");
    try {
      const backup = await exportFullBackup();
      downloadJson(backup);
      setStatus(`Backup exported with ${backup.stores.tracking.sites.length} site records and ${backup.media?.length ?? 0} uploaded files, including web image sizes.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Backup export failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const selection = ++fileSelection.current;
    setPendingBackup(null);
    event.target.value = "";
    if (file.size > 1_000_000_000) { setStatus("This backup exceeds the maximum 1 GB import size."); return; }
    setStatus(`Reading ${file.name}…`);
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      if (selection !== fileSelection.current) return;
      setPendingBackup(parsed);
      setStatus(`Backup loaded from ${file.name}. Review the summary before importing.`);
    } catch (error) {
      if (selection === fileSelection.current) setStatus(error instanceof Error ? error.message : "Backup file could not be read.");
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
      await onImported?.();
      setPendingBackup(null);
      setStatus("Backup imported. Open Website and Sites to review the restored data.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Backup import failed. Please retry.");
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
          <p className="eyebrow">Content and photographs</p>
          <h2 id="backup-export-title">Everything you need to restore your site</h2>
          <p className="backup-intro">
            Download a portable copy to move between servers or keep off-site. In production, exporting also saves a copy on the backend; publishing creates an automatic backup too.
          </p>
          <ul className="backup-list">
            <li>Published website content, draft content and revision history.</li>
            <li>Uploaded project photographs, gallery images and every responsive image size — the actual files, not just links.</li>
            <li>Sites, QR links, map embeds, private notes, Searchland links and uploaded letters.</li>
            <li>Mailing statuses, reminders, Royal Mail tracking fields and mailing notes.</li>
            <li>Analytics visit records and contact/newsletter lead logs.</li>
          </ul>
          <p className="backup-intro">External photography, including the Unsplash placeholders, stays as links. Upload your project photographs to include their files. Keep backup files private: they contain your Studio records.</p>
        </section>

        <section className="admin-panel" aria-labelledby="backup-import-title">
          <p className="eyebrow">Restore</p>
          <h2 id="backup-import-title">Import backup</h2>
          <label className="backup-drop">
            <UploadCloud aria-hidden="true" />
            <span>Choose Kingsvale backup JSON</span>
            <input className="sr-only" type="file" accept="application/json,.json" disabled={busy} onChange={handleFileChange} />
          </label>
          <label className="admin-field" htmlFor="backup-mode">
            <span className="admin-field__label">Import mode</span>
            <select id="backup-mode" value={importMode} disabled={busy} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
              <option value="replace">Replace everything</option>
              <option value="merge">Merge sites, visits and leads</option>
            </select>
          </label>
          <p className="backup-intro">{importMode === "replace" ? "Replaces website content, saved drafts, sites, analytics and leads. The server saves a recovery backup first." : "Replaces website content and draft. Keeps existing sites, visits and leads alongside imported records; matching site IDs use the imported version."}</p>
          {summary && (
            <div className="backup-summary" aria-label="Selected backup summary">
              <span>Exported {summary.exportedAt}</span>
              <strong>{summary.sites} sites</strong>
              <strong>{summary.visits} analytics visits</strong>
              <strong>{summary.leads} lead log lines</strong>
              <strong>{summary.files} uploaded files · {(summary.bytes / 1_000_000).toFixed(1)} MB</strong>
              {pendingBackup?.version === 1 && <span>This older backup does not bundle server uploads. Missing files must still exist on the destination server.</span>}
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
    files: backup.media?.length ?? 0,
    bytes: backup.media?.reduce((total, file) => total + file.bytes, 0) ?? 0,
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
