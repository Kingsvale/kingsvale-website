import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const compress = promisify(gzip);
const api = "https://www.googleapis.com/drive/v3";
const scope = "https://www.googleapis.com/auth/drive.file";
const tag = "kingsvale-backup-v1";
const account = "info@kingsvalehomes.co.uk";
const fields = "id,name,size,createdTime,md5Checksum,appProperties,parents,trashed,mimeType";
const hash = (value, algorithm = "sha256") => createHash(algorithm).update(value).digest("hex");

export function londonDate(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function backupDue(state, now = new Date()) {
  if (!state.enabled || !state.refreshToken || state.lastSuccessDay === londonDate(now)) return false;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= 3 && (!state.lastAttempt || now.getTime() - Date.parse(state.lastAttempt) >= 60 * 60 * 1000);
}

// Only callers' verified, owned snapshots belong here. Calendar buckets avoid
// manual backups on one day displacing seven days of recovery history.
export function retentionPlan(files, budgetBytes) {
  const sorted = [...files].sort((a, b) => b.createdTime.localeCompare(a.createdTime) || b.id.localeCompare(a.id));
  if (!sorted.length) return { keep: [], remove: [] };
  const selected = new Set([sorted[0].id]);
  for (const [limit, bucket] of [
    [7, (d) => londonDate(d)],
    [4, (d) => { const date = new Date(`${londonDate(d)}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); }],
    [2, (d) => londonDate(d).slice(0, 7)]
  ]) {
    const seen = new Set();
    for (const file of sorted) {
      const key = bucket(new Date(file.createdTime));
      if (!seen.has(key) && seen.size < limit) { selected.add(file.id); seen.add(key); }
    }
  }
  let bytes = 0;
  const keep = [], remove = [];
  for (const file of sorted) {
    if (selected.has(file.id) && (keep.length === 0 || bytes + Number(file.size) <= budgetBytes)) {
      keep.push(file); bytes += Number(file.size);
    } else remove.push(file);
  }
  return { keep, remove };
}

export async function createDriveBackup({ directory, buildBackup, encode, decode, encryptionAvailable, maxRawBytes = 250_000_000, origin = "https://kingsvalehomes.co.uk", fetchImpl = fetch, now = () => new Date() }) {
  const file = join(directory, "google-drive-backup.json");
  const redirectUri = `${new URL(origin).origin}/api/drive-backup/callback`;
  await mkdir(directory, { recursive: true });
  let state, loadError;
  try { state = decode(await readFile(file, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") loadError = "Google Drive backup settings could not be read. Restore the original CMS_ENCRYPTION_KEY or recover the private settings file on the server. Existing settings have not been overwritten."; }
  state ??= { instance: randomBytes(16).toString("hex"), enabled: false, budgetGb: 3, history: [] };
  let busy = false, phase = "", pending;
  async function save() {
    if (loadError) throw new Error(loadError);
    await writeFile(`${file}.tmp`, encode(state), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
  }
  const properties = () => ({ app: tag, instance: state.instance });
  const owned = (item) => item.appProperties?.app === tag && item.appProperties?.instance === state.instance;
  const managed = (item) => owned(item) && item.parents?.includes(state.folderId) && !item.trashed;
  const verified = (item) => managed(item) && item.appProperties?.status === "verified" && /^kingsvale-.*\.json\.gz$/.test(item.name) && Number(item.size) > 0 && Number.isFinite(Date.parse(item.createdTime));
  function idle() {
    if (loadError) throw new Error(loadError);
    if (busy) throw new Error("A backup or connection check is running. Please wait.");
  }
  function status() {
    return {
      configured: Boolean(state.clientId && state.clientSecret), encryptionAvailable,
      connected: Boolean(state.refreshToken), enabled: state.enabled, account: state.email || account,
      clientId: state.clientId || "", redirectUri, budgetGb: state.budgetGb,
      folderUrl: state.folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(state.folderId)}` : null,
      busy, phase, lastSuccess: state.lastSuccess || null, lastAttempt: state.lastAttempt || null,
      lastError: loadError || state.lastError || null, warning: state.warning || null,
      retainedBytes: state.retainedBytes || 0, driveFreeBytes: state.driveFreeBytes ?? null,
      history: state.history || [], schedule: "Daily at 03:00, Europe/London", maxRawBytes
    };
  }
  async function request(url, options = {}) {
    let result;
    try { result = await fetchImpl(url, { ...options, redirect: "error", signal: AbortSignal.timeout(180_000) }); }
    catch { throw new Error("Google Drive could not be reached. The next automatic attempt is in one hour."); }
    if (!result.ok) {
      if (result.status === 401) throw new Error("Google authorisation expired. Reconnect Google Drive in Backup settings.");
      if (result.status === 403 || result.status === 429) throw new Error("Google Drive refused the request. Check Drive storage, API access and account permissions; automatic retries run hourly.");
      if (result.status === 404) throw new Error("The Google Drive backup folder or file is missing. Reconnect to create a new backup folder.");
      throw new Error(`Google Drive request failed (${result.status}). Check the Google setup and retry.`);
    }
    return result;
  }
  async function token(parameters) {
    const response = await request("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: state.clientId, client_secret: state.clientSecret, ...parameters }) });
    const data = await response.json();
    if (!data.access_token) throw new Error("Google did not provide access. Reconnect Google Drive.");
    return data;
  }
  async function access() {
    if (!state.refreshToken) throw new Error("Connect Google Drive first.");
    try { return (await token({ refresh_token: state.refreshToken, grant_type: "refresh_token" })).access_token; }
    catch (error) {
      if (error.message.includes("(400)")) throw new Error("Google authorisation needs renewing. Reconnect Drive; use an Internal Google Workspace app, not an External app left in Testing.");
      throw error;
    }
  }
  async function json(path, accessToken, options = {}) {
    const response = await request(`${api}${path}`, { ...options, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...options.headers } });
    return response.status === 204 ? null : response.json();
  }
  async function about(accessToken) {
    const result = await json("/about?fields=user(emailAddress),storageQuota", accessToken);
    if (result.user?.emailAddress?.toLowerCase() !== account) throw new Error(`Please connect ${account}, the main Google Workspace mailbox.`);
    const quota = result.storageQuota;
    state.driveFreeBytes = quota?.limit ? Math.max(0, Number(quota.limit) - Number(quota.usage || 0)) : null;
    return result;
  }
  async function folder(accessToken) {
    if (state.folderId) {
      const item = await json(`/files/${encodeURIComponent(state.folderId)}?fields=${fields}`, accessToken);
      if (!owned(item) || item.trashed || item.mimeType !== "application/vnd.google-apps.folder") throw new Error("The backup folder is no longer valid. Reconnect Google Drive.");
      return;
    }
    const item = await json("/files?fields=id", accessToken, { method: "POST", body: JSON.stringify({ name: "Kingsvale website backups", mimeType: "application/vnd.google-apps.folder", appProperties: properties() }) });
    state.folderId = item.id;
    await save();
  }
  async function list(accessToken) {
    const files = [];
    let pageToken = "";
    do {
      const query = new URLSearchParams({ q: `'${state.folderId}' in parents and trashed = false and appProperties has { key='app' and value='${tag}' } and appProperties has { key='instance' and value='${state.instance}' }`, fields: `nextPageToken,files(${fields})`, pageSize: "1000", ...(pageToken ? { pageToken } : {}) });
      const page = await json(`/files?${query}`, accessToken);
      files.push(...(page.files || []).filter(managed));
      pageToken = page.nextPageToken || "";
    } while (pageToken);
    return files;
  }
  async function configure(input) {
    idle();
    if (!encryptionAvailable) throw new Error("Set CMS_ENCRYPTION_KEY on the server before saving a Google connection.");
    const clientId = String(input.clientId || state.clientId || "").trim();
    const secret = String(input.clientSecret || state.clientSecret || "").trim();
    if (!/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) || !secret || secret.length > 500) throw new Error("Enter the Google OAuth web client ID and client secret.");
    const budget = Number(input.budgetGb ?? state.budgetGb);
    if (![1, 2, 3, 5].includes(budget)) throw new Error("Choose a backup storage budget of 1, 2, 3 or 5 GB.");
    if (state.clientId && state.clientId !== clientId && state.refreshToken) throw new Error("Disconnect Google Drive before changing the OAuth client.");
    busy = true;
    try {
      state = { ...state, clientId, clientSecret: secret, budgetGb: budget, enabled: Boolean(input.enabled && state.refreshToken) };
      pending = undefined;
      await save();
    } finally { busy = false; }
    return status();
  }
  function connect() {
    idle();
    if (!encryptionAvailable || !state.clientId || !state.clientSecret) throw new Error("Save your Google setup first.");
    const nonce = randomBytes(32).toString("base64url"), browser = randomBytes(32).toString("base64url"), verifier = randomBytes(32).toString("base64url");
    pending = { nonce, browser, verifier, expires: now().getTime() + 10 * 60_000 };
    const params = new URLSearchParams({ client_id: state.clientId, redirect_uri: redirectUri, response_type: "code", scope, access_type: "offline", prompt: "consent", login_hint: account, state: nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, browser };
  }
  async function callback(params, browser) {
    idle();
    const attempt = pending;
    pending = undefined;
    if (!attempt || attempt.expires < now().getTime() || params.get("state") !== attempt.nonce || browser !== attempt.browser) throw new Error("This Google connection request expired. Return to Studio → Backup and connect again.");
    if (params.get("error") || !params.get("code")) throw new Error("Google connection was cancelled. No backup settings were changed.");
    busy = true; phase = "Connecting Google Drive";
    try {
      const credentials = await token({ code: params.get("code"), redirect_uri: redirectUri, code_verifier: attempt.verifier, grant_type: "authorization_code" });
      await about(credentials.access_token);
      if (!credentials.refresh_token) throw new Error("Google did not allow background access. Reconnect and approve access.");
      // Retain our own folder on renewal so reconnecting does not leave archives
      // outside the retention policy. Never accept an arbitrary folder ID.
      state.refreshToken = credentials.refresh_token; state.email = account;
      state.enabled = true; state.lastError = null;
      state.lastSuccessDay = null; state.lastAttempt = null;
      await save();
      await folder(credentials.access_token);
      return status();
    } finally { busy = false; phase = ""; }
  }
  async function disconnect() {
    idle(); pending = undefined;
    // Remove background authority locally. Existing archives remain downloadable.
    busy = true;
    try {
      state.enabled = false; delete state.refreshToken; state.lastError = null;
      await save();
    } finally { busy = false; }
    return status();
  }
  async function perform() {
    state.lastAttempt = now().toISOString(); state.lastError = null; state.warning = null;
    await save();
    try {
      phase = "Preparing a complete backup";
      const backup = await buildBackup();
      const raw = Buffer.from(JSON.stringify(backup));
      if (raw.length > maxRawBytes - 1000) throw new Error("This backup exceeds the server restore limit. Increase BACKUP_IMPORT_MAX_MB before creating a larger backup.");
      const archive = await compress(raw, { level: 9 });
      if (archive.length > state.budgetGb * 1e9) throw new Error("One backup exceeds your Drive backup budget. Increase the budget in Studio.");
      phase = "Checking Google Drive storage";
      const accessToken = await access();
      await about(accessToken);
      if (state.driveFreeBytes !== null && state.driveFreeBytes < archive.length + 500_000_000) throw new Error("Drive needs space for a new backup plus 500 MB of headroom. Free space or increase your Google storage. Existing backups have been preserved.");
      await folder(accessToken);
      phase = "Uploading to Google Drive";
      const name = `kingsvale-${now().toISOString().replaceAll(":", "-")}-${randomBytes(3).toString("hex")}.json.gz`;
      const session = await request("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Upload-Content-Type": "application/gzip", "X-Upload-Content-Length": String(archive.length) }, body: JSON.stringify({ name, parents: [state.folderId], appProperties: { ...properties(), status: "pending" } }) });
      const location = new URL(session.headers.get("location"));
      if (location.origin !== "https://www.googleapis.com" || !location.pathname.startsWith("/upload/drive/")) throw new Error("Google returned an unexpected upload destination.");
      const uploaded = await (await request(location.href, { method: "PUT", headers: { "Content-Type": "application/gzip", "Content-Length": String(archive.length) }, body: archive })).json();
      phase = "Verifying the uploaded archive";
      const remote = await json(`/files/${encodeURIComponent(uploaded.id)}?fields=${fields}`, accessToken);
      if (!managed(remote) || remote.md5Checksum !== hash(archive, "md5") || Number(remote.size) !== archive.length) throw new Error("Upload verification failed. Existing backups have been preserved.");
      await json(`/files/${encodeURIComponent(remote.id)}?fields=id`, accessToken, { method: "PATCH", body: JSON.stringify({ appProperties: { ...properties(), status: "verified", sha256: hash(archive) } }) });
      state.lastSuccess = now().toISOString(); state.lastSuccessDay = londonDate(now());
      state.history = [{ id: remote.id, name: remote.name, size: Number(remote.size), createdAt: remote.createdTime }, ...(state.history || [])];
      state.retainedBytes = (state.retainedBytes || 0) + Number(remote.size);
      await save();
      phase = "Keeping your backup storage tidy";
      try {
        const all = await list(accessToken);
        const snapshots = all.filter(verified);
        if (!snapshots.some((item) => item.id === remote.id)) throw new Error("The verified upload was not found when checking retention.");
        const plan = retentionPlan(snapshots, state.budgetGb * 1e9);
        // Pending files are incomplete earlier uploads. Remove them only after a
        // complete replacement exists, never files outside this installation.
        const remove = [...plan.remove, ...all.filter((item) => item.appProperties?.status === "pending")];
        for (const item of remove) {
          if (item.id === remote.id) continue;
          const check = await json(`/files/${encodeURIComponent(item.id)}?fields=${fields}`, accessToken);
          if (!managed(check) || !["pending", "verified"].includes(check.appProperties.status)) throw new Error("A backup moved during cleanup. Cleanup stopped safely.");
          await json(`/files/${encodeURIComponent(item.id)}`, accessToken, { method: "DELETE" });
        }
        state.history = plan.keep.map((item) => ({ id: item.id, name: item.name, size: Number(item.size), createdAt: item.createdTime }));
        state.retainedBytes = plan.keep.reduce((total, item) => total + Number(item.size), 0);
        if (plan.keep.length < 7) state.warning = "Building your recovery history. Storage limits may shorten the number of restore points kept.";
      } catch {
        state.warning = "Your new backup is verified, but retention cleanup could not finish. Storage may exceed the budget until the next successful backup. Check Google Drive permissions and storage.";
      }
      await save();
    } catch (error) {
      state.lastError = error.message;
      await save();
    } finally { busy = false; phase = ""; }
  }
  function run() {
    idle();
    if (!state.refreshToken) throw new Error("Connect Google Drive first.");
    busy = true; phase = "Starting backup";
    return perform().finally(() => { busy = false; phase = ""; });
  }
  async function tick() { if (!busy && backupDue(state, now())) await run(); }
  return { status, configure, connect, callback, disconnect, run, tick };
}
