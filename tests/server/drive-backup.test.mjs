import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createDriveBackup, backupDue, retentionPlan } from "../../server/drive-backup.mjs";
import { prepareMediaRestore } from "../../server/media-backup.mjs";

const client = { clientId: "test-client.apps.googleusercontent.com", clientSecret: "private-test-secret", budgetGb: 3 };
const picture = Buffer.from("test media bytes preserved exactly");
const archive = { kind: "kingsvale-full-backup", version: 2, exportedAt: "2026-09-15T02:00:00Z", stores: { cms: { image: "/media/project.webp" }, tracking: { sites: [] }, settings: {}, analytics: { visits: [] }, leads: { contact: "", newsletter: "" } }, media: [{ filename: "project.webp", bytes: picture.length, sha256: createHash("sha256").update(picture).digest("hex"), data: picture.toString("base64") }] };

async function setup(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-drive-"));
  t.after(async () => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "kingsvale-drive-")); await rm(directory, { recursive: true, force: true }); });
  const clock = { value: new Date("2026-09-15T03:00:00Z") };
  const drive = { files: new Map(), deleted: [], uploads: [], requests: [], badChecksum: false, failUpload: false, quota: 30e9, used: 1e9, failDelete: false, email: "info@kingsvalehomes.co.uk", count: 0, next: null };
  const response = (data, status = 200, headers = {}) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input), method = init.method || "GET";
    drive.requests.push({ url, method });
    if (url.hostname === "oauth2.googleapis.com") return response({ access_token: "private-access-token", refresh_token: "private-refresh-token" });
    if (url.pathname.endsWith("/about")) return response({ user: { emailAddress: drive.email }, storageQuota: { limit: String(drive.quota), usage: String(drive.used) } });
    if (url.pathname.startsWith("/upload/drive/")) {
      if (method === "POST") { drive.next = JSON.parse(init.body); return response({}, 200, { location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=test" }); }
      if (drive.failUpload) return response({}, 503);
      const body = Buffer.from(init.body); drive.uploads.push(body);
      const item = { ...drive.next, id: `backup-${++drive.count}`, size: String(body.length), createdTime: clock.value.toISOString(), md5Checksum: drive.badChecksum ? "bad-checksum" : createHash("md5").update(body).digest("hex") };
      drive.files.set(item.id, item); return response({ id: item.id });
    }
    if (url.pathname === "/drive/v3/files") {
      if (method === "POST") { const item = { ...JSON.parse(init.body), id: `folder-${++drive.count}` }; drive.files.set(item.id, item); return response(item); }
      // Deliberately return unrelated files too; the service must filter locally.
      return response({ files: [...drive.files.values()] });
    }
    const id = url.pathname.split("/").at(-1), item = drive.files.get(id);
    if (!item) return response({}, 404);
    if (method === "PATCH") { Object.assign(item, JSON.parse(init.body)); return response(item); }
    if (method === "DELETE") { if (drive.failDelete) return response({}, 403); drive.deleted.push(item); drive.files.delete(id); return response(null, 204); }
    return response(item);
  };
  const args = { directory, buildBackup: async () => structuredClone(archive), encode: (data) => JSON.stringify(data), decode: JSON.parse, encryptionAvailable: true, fetchImpl, now: () => clock.value, ...options };
  const manager = await createDriveBackup(args);
  async function connect() {
    await manager.configure(client);
    const connection = manager.connect();
    const params = new URL(connection.url).searchParams;
    assert.equal(params.get("scope"), "https://www.googleapis.com/auth/drive.file");
    assert.equal(params.get("access_type"), "offline");
    assert.equal(params.get("code_challenge_method"), "S256");
    await manager.callback(new URLSearchParams({ state: params.get("state"), code: "test-code" }), connection.browser);
  }
  return { manager, drive, clock, connect, args, directory };
}

test("daily archive is verified, restores media independently and survives server restarts", async (t) => {
  const { manager, drive, clock, connect, args, directory } = await setup(t);
  await connect(); await manager.tick();
  assert.equal(drive.uploads.length, 1);
  assert.equal(manager.status().lastError, null);
  const parsed = JSON.parse(gunzipSync(drive.uploads[0]));
  assert.deepEqual(parsed, archive);
  const restorePath = join(directory, "restore");
  await (await prepareMediaRestore(parsed, restorePath))();
  assert.deepEqual(await readFile(join(restorePath, "project.webp")), picture);
  assert.ok(!JSON.stringify(manager.status()).includes("private-test-secret"));
  assert.ok(!JSON.stringify(manager.status()).includes("private-refresh-token"));
  assert.ok(!JSON.stringify(parsed).includes("private-refresh-token"));
  const restarted = await createDriveBackup(args);
  await restarted.tick(); assert.equal(drive.uploads.length, 1);
  clock.value = new Date("2026-09-16T10:00:00Z");
  await restarted.tick(); assert.equal(drive.uploads.length, 2);
  assert.equal(restarted.status().history.length, 2);
});

test("Google connection is bound to the initiating browser and one-time state", async (t) => {
  const { manager, drive } = await setup(t);
  await manager.configure(client);
  const start = manager.connect(); const state = new URL(start.url).searchParams.get("state");
  await assert.rejects(manager.callback(new URLSearchParams({ state, code: "test" }), "wrong-browser"), /expired/);
  assert.equal(drive.requests.length, 0);
  await assert.rejects(manager.callback(new URLSearchParams({ state, code: "test" }), start.browser), /expired/);
  assert.equal(manager.status().connected, false);
});

test("incorrect Workspace account cannot enable backups", async (t) => {
  const { manager, drive, connect } = await setup(t); drive.email = "wrong@example.com";
  await assert.rejects(connect(), /main Google Workspace mailbox/);
  assert.equal(manager.status().connected, false);
});

test("retention preserves calendar history, caps bytes and always keeps latest", () => {
  const files = Array.from({ length: 100 }, (_, i) => ({ id: String(i), size: "100", createdTime: new Date(Date.UTC(2026, 8, 15 - i, 3)).toISOString() }));
  const plan = retentionPlan(files, 10_000);
  assert.ok(plan.keep.length <= 13);
  for (let i = 0; i < 7; i++) assert.ok(plan.keep.some((file) => file.id === String(i)));
  assert.ok(plan.keep.some((file) => file.createdTime.startsWith("2026-08")));
  const small = retentionPlan(files, 250);
  assert.equal(small.keep.length, 2); assert.equal(small.keep[0].id, "0");
  assert.equal(retentionPlan(files, 1).keep[0].id, "0");
});

test("cleanup permanently deletes only owned old archives after successful verification", async (t) => {
  const { manager, drive, clock, connect } = await setup(t); await connect();
  const folder = [...drive.files.values()][0];
  drive.files.set("unrelated", { id: "unrelated", name: "Family photos", parents: [folder.id], size: "5000000", createdTime: "2020-01-01T00:00:00Z" });
  drive.files.set("other-install", { id: "other-install", name: "kingsvale-old.json.gz", parents: [folder.id], appProperties: { ...folder.appProperties, instance: "another-installation", status: "verified" }, size: "50000", createdTime: "2020-01-01T00:00:00Z" });
  for (let day = 1; day <= 20; day++) { clock.value = new Date(Date.UTC(2026, 8, day, 3)); await manager.run(); }
  assert.ok(drive.deleted.length > 0);
  assert.ok(drive.files.has("unrelated")); assert.ok(drive.files.has("other-install"));
  assert.ok(drive.deleted.every((file) => file.appProperties.instance === folder.appProperties.instance && file.appProperties.status === "verified"));
  assert.equal(manager.status().lastError, null);
});

test("failed uploads and corrupt verification never prune good backups; retries are hourly", async (t) => {
  const { manager, drive, clock, connect } = await setup(t); await connect(); await manager.run();
  const success = manager.status().lastSuccess;
  clock.value = new Date("2026-09-16T03:00:00Z"); drive.failUpload = true;
  await manager.tick(); assert.ok(manager.status().lastError); assert.equal(manager.status().lastSuccess, success);
  const requests = drive.requests.length; await manager.tick(); assert.equal(drive.requests.length, requests);
  drive.failUpload = false; drive.badChecksum = true; clock.value = new Date("2026-09-16T04:01:00Z");
  await manager.tick(); assert.match(manager.status().lastError, /verification failed/); assert.equal(drive.deleted.length, 0);
  drive.badChecksum = false; clock.value = new Date("2026-09-16T05:02:00Z"); await manager.tick();
  assert.equal(manager.status().lastError, null); assert.ok(drive.deleted.some((item) => item.appProperties.status === "pending"));
});

test("quota and restore size checks stop uploads without deleting existing backups", async (t) => {
  const { manager, drive, connect } = await setup(t); await connect(); drive.used = drive.quota - 400_000_000;
  await manager.run(); assert.match(manager.status().lastError, /headroom/); assert.equal(drive.uploads.length, 0); assert.equal(drive.deleted.length, 0);
  const small = await setup(t, { maxRawBytes: 100 }); await small.connect(); await small.manager.run();
  assert.match(small.manager.status().lastError, /restore limit/); assert.equal(small.drive.uploads.length, 0);
});

test("pause, disconnect and renewal preserve the folder and prevent scheduled uploads", async (t) => {
  const { manager, drive, connect, clock } = await setup(t); await connect(); await manager.run();
  const folder = manager.status().folderUrl;
  await connect(); assert.equal(manager.status().folderUrl, folder);
  await manager.configure({ ...client, enabled: false }); clock.value = new Date("2026-09-17T06:00:00Z");
  await manager.tick(); assert.equal(drive.uploads.length, 1);
  await manager.disconnect(); assert.equal(manager.status().connected, false); assert.equal(drive.deleted.length, 0);
  assert.throws(() => manager.run(), /Connect Google Drive first/);
});

test("schedule follows London daylight saving, catches up and respects retry delay", () => {
  const state = { enabled: true, refreshToken: "test" };
  assert.equal(backupDue(state, new Date("2026-07-01T01:59:00Z")), false);
  assert.equal(backupDue(state, new Date("2026-07-01T02:00:00Z")), true);
  assert.equal(backupDue(state, new Date("2026-12-01T02:59:00Z")), false);
  assert.equal(backupDue(state, new Date("2026-12-01T03:00:00Z")), true);
  assert.equal(backupDue({ ...state, lastSuccessDay: "2026-12-01" }, new Date("2026-12-01T12:00:00Z")), false);
});

test("credentials cannot be saved without server encryption", async (t) => {
  const { manager } = await setup(t, { encryptionAvailable: false });
  await assert.rejects(manager.configure(client), /CMS_ENCRYPTION_KEY/);
});

test("cleanup failure retains the new verified restore point and reports storage uncertainty", async (t) => {
  const { manager, drive, clock, connect } = await setup(t); await connect(); await manager.run();
  drive.failDelete = true;
  clock.value = new Date("2026-09-15T04:01:00Z"); await manager.run();
  assert.equal(manager.status().lastError, null);
  assert.match(manager.status().warning, /cleanup could not finish/);
  assert.equal(manager.status().history.length, 2);
  assert.equal(drive.deleted.length, 0);
  clock.value = new Date("2026-09-16T04:00:00Z"); drive.failDelete = false; await manager.run();
  assert.ok(drive.deleted.length > 0);
  assert.equal(manager.status().history.length, 2);
});

test("an in-flight upload blocks overlapping runs and configuration changes", async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { manager, connect } = await setup(t, { buildBackup: async () => { await gate; return archive; } });
  await connect();
  const running = manager.run();
  assert.throws(() => manager.run(), /running/);
  await assert.rejects(manager.configure(client), /running/);
  await assert.rejects(manager.disconnect(), /running/);
  release(); await running;
  assert.equal(manager.status().busy, false);
});

test("unreadable private settings disable backups without replacing credentials or crashing the website", async (t) => {
  const { directory, args } = await setup(t);
  const file = join(directory, "google-drive-backup.json");
  await writeFile(file, "corrupted-encrypted-settings");
  const manager = await createDriveBackup(args);
  assert.match(manager.status().lastError, /could not be read/);
  await assert.rejects(manager.configure(client), /could not be read/);
  await manager.tick();
  assert.equal(await readFile(file, "utf8"), "corrupted-encrypted-settings");
});
