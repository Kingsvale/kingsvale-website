import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const filenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,219}\.(webp|avif|png|jpe?g|pdf|docx?)$/i;
const digest = (data) => createHash("sha256").update(data).digest("hex");

// Include all uploads, including responsive variants and images in saved revisions.
export async function collectMedia(directory) {
  await mkdir(directory, { recursive: true });
  const media = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile()) continue;
    if (!filenamePattern.test(entry.name)) throw new Error(`Cannot back up unsupported media file: ${entry.name}`);
    const data = await readFile(join(directory, entry.name));
    media.push({ filename: entry.name, bytes: data.length, sha256: digest(data), data: data.toString("base64") });
  }
  return media;
}

export function decodeMedia(media) {
  if (!Array.isArray(media) || media.length > 5000) throw new Error("Backup media must be a list of up to 5,000 files.");
  const names = new Set();
  return media.map((file) => {
    if (!file || !filenamePattern.test(file.filename) || names.has(file.filename.toLowerCase())) {
      throw new Error("Backup contains an unsafe or duplicate media filename.");
    }
    names.add(file.filename.toLowerCase());
    if (typeof file.data !== "string" || !file.data.length || file.data.length > 24_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) {
      throw new Error(`Invalid media data: ${file.filename}`);
    }
    const bytes = Buffer.from(file.data, "base64");
    if (bytes.toString("base64") !== file.data || bytes.length !== file.bytes || digest(bytes) !== file.sha256) {
      throw new Error(`Media integrity check failed: ${file.filename}`);
    }
    return { filename: file.filename, bytes };
  });
}

export function mediaReferences(value, found = new Set()) {
  if (typeof value === "string" && value.startsWith("/media/")) found.add(value.slice(7));
  else if (Array.isArray(value)) value.forEach((item) => mediaReferences(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => mediaReferences(item, found));
  return found;
}

// Check the entire archive before changing files or content. Existing media is immutable.
export async function prepareMediaRestore(backup, directory) {
  if (![1, 2].includes(backup.version)) throw new Error("This backup version is not supported.");
  const files = decodeMedia(backup.media ?? (backup.version === 1 ? [] : null));
  const included = new Set(files.map((file) => file.filename));
  for (const filename of mediaReferences(backup.stores)) {
    if (!filenamePattern.test(filename)) throw new Error("Backup contains an unsafe media reference.");
    if (!included.has(filename)) {
      if (backup.version === 2) throw new Error(`Backup is missing an uploaded file: ${filename}`);
      try { await readFile(join(directory, filename)); }
      catch { throw new Error(`This older backup has no copy of ${filename}. Export a new full backup from the original server.`); }
    }
  }
  const pending = [];
  for (const file of files) {
    let existing;
    try { existing = await readFile(join(directory, file.filename)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (existing && !existing.equals(file.bytes)) throw new Error(`A different file already uses the name ${file.filename}. Nothing was imported.`);
    if (!existing) pending.push(file);
  }
  return async () => {
    await mkdir(directory, { recursive: true });
    for (const file of pending) await writeFile(join(directory, file.filename), file.bytes, { flag: "wx" });
  };
}
