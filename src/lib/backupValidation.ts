import type { KingsvaleBackup } from "./cmsApi";

export function parseBackup(value: unknown): KingsvaleBackup {
  const backup = value as KingsvaleBackup | null;
  if (!backup || backup.kind !== "kingsvale-full-backup" || ![1, 2].includes(backup.version)) throw new Error("Choose a supported Kingsvale full backup JSON file.");
  const stores = backup.stores;
  if (!stores || !stores.cms || typeof stores.cms !== "object" || !Array.isArray(stores.tracking?.sites)
    || !Array.isArray((stores.analytics as { visits?: unknown[] } | null)?.visits)
    || typeof stores.leads?.contact !== "string" || typeof stores.leads?.newsletter !== "string"
    || !Number.isFinite(Date.parse(backup.exportedAt))) throw new Error("This backup is incomplete. Export a new full backup and try again.");
  if (backup.version === 2 && !Array.isArray(backup.media)) throw new Error("This backup is missing its uploaded files.");
  if (backup.media !== undefined && (!Array.isArray(backup.media) || backup.media.some((file) => !file || typeof file.filename !== "string" || typeof file.data !== "string" || typeof file.sha256 !== "string" || !Number.isSafeInteger(file.bytes) || file.bytes < 1))) throw new Error("The uploaded file list is invalid.");
  return backup;
}
