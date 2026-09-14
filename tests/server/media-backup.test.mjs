import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash, createDecipheriv } from "node:crypto";
import sharp from "sharp";
import { defaultContent } from "../../src/data/defaultContent.ts";
import { createTrackingSite } from "../../src/lib/trackingStorage.ts";

const password = "test-only-kingsvale-images";
const encryptionKey = "test-only-media-backup-encryption-key";

test("public health identifies the running release without caching or exposing credentials", async (t) => {
  const server = await startServer(t);
  const response = await fetch(`${server.url}/api/ops/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const status = await response.json();
  assert.equal(status.ok, true);
  assert.equal(status.revision, "a".repeat(40));
  assert.ok(!JSON.stringify(status).includes(password));
  assert.ok(!JSON.stringify(status).includes(encryptionKey));
});

test("Drive backup settings require Studio authentication and persist encrypted outside exports", async (t) => {
  const server = await startServer(t);
  const denied = await fetch(`${server.url}/api/drive-backup`);
  assert.equal(denied.status, 401);
  const setup = { clientId: "test-client.apps.googleusercontent.com", clientSecret: "test-only-drive-secret", budgetGb: 3 };
  const saved = await server.api("/api/drive-backup", "PUT", setup);
  assert.equal(saved.status, 200);
  const status = await saved.json();
  assert.equal(status.configured, true);
  assert.equal(status.connected, false);
  assert.ok(!JSON.stringify(status).includes(setup.clientSecret));
  const stored = await readFile(join(server.directory, "private", "google-drive-backup.json"), "utf8");
  assert.equal(JSON.parse(stored).encrypted, true);
  assert.ok(!stored.includes(setup.clientSecret));
  assert.equal((await server.api("/api/drive-backup/run", "POST", {})).status, 400);
  const exported = await server.api("/api/backup", "GET");
  assert.equal(exported.status, 200);
  assert.ok(!(await exported.text()).includes(setup.clientSecret));
});

test("starter letters generate on the backend and document previews require authentication", async (t) => {
  const server = await startServer(t);
  const site = { ...createTrackingSite(), reference: "KV-LETTER-TEST", letterTemplateUrl: "/templates/kingsvale-initial-letter-template.docx" };
  const response = await server.api("/api/letters/generate", "POST", { site, templateUrl: site.letterTemplateUrl, publicLink: `${server.url}/track/${site.token}` });
  assert.equal(response.status, 201);
  const { file } = await response.json();
  assert.ok(file.url.startsWith("/media/"));
  const bytes = Buffer.from(await (await fetch(`${server.url}${file.url}`)).arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  const denied = await fetch(`${server.url}/api/letters/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: file.url }) });
  assert.equal(denied.status, 401);
  assert.equal((await server.api("/api/letters/preview", "POST", { url: "https://example.com/private.docx" })).status, 422);
});

async function startServer(t) {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-media-"));
  const child = spawn(process.execPath, ["server/secure-server.mjs"], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...process.env, APP_REVISION: "a".repeat(40), PORT: "0", KINGSVALE_DATA_DIR: directory, STUDIO_PASSWORD: password, STUDIO_USER: "kingsvale", STUDIO_AUTH_TOKEN_SECRET: "test-only-image-auth-token-secret", CMS_ENCRYPTION_KEY: encryptionKey, STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(async () => {
    if (child.exitCode === null) { const closed = new Promise((done) => child.once("exit", done)); child.kill(); await closed; }
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "kingsvale-media-"));
    await rm(directory, { recursive: true, force: true });
  });
  const url = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stderr.on("data", (data) => process.stderr.write(data));
    child.stdout.on("data", (data) => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } });
  });
  const login = await fetch(`${url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "kingsvale", password }) });
  assert.equal(login.status, 200);
  const { authToken } = await login.json();
  const api = (path, method = "GET", body) => fetch(`${url}${path}`, { method, headers: { Authorization: `Bearer ${authToken}`, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  return { url, directory, api };
}

test("uploaded photos survive export, a fresh server restore, revisions and merge; corrupt archives cannot change content", { timeout: 60000 }, async (t) => {
  const source = await startServer(t);
  const destination = await startServer(t);
  const bytes = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#758871" } }).png().toBuffer();
  const form = new FormData(); form.set("image", new Blob([bytes], { type: "image/png" }), "Project garden.png");
  const upload = await source.api("/api/uploads/images", "POST", form);
  assert.equal(upload.status, 201);
  const { image } = await upload.json();
  assert.equal(image.width, 1600);
  assert.deepEqual(image.variants.map((variant) => variant.width), [480, 960, 1440, 1600]);
  const content = structuredClone(defaultContent);
  content.hero.image.alt = "";
  content.textOverrides = { about_heading: "Homes made with care" };
  content.imageOverrides = { logo: { ...image, alt: "Custom studio logo" } };
  content.developments[0].image = { ...image, alt: "Garden at The Ridings", focalPoint: "20% 75%" };
  content.developments[0].gallery = [{ ...image, alt: "Project garden" }];
  assert.equal((await source.api("/api/cms/publish", "POST", { content })).status, 200);
  const second = structuredClone(content); second.hero.title = "New project photographs";
  assert.equal((await source.api("/api/cms/publish", "POST", { content: second })).status, 200);
  const { backup } = await (await source.api("/api/backup")).json();
  assert.equal(backup.version, 2);
  assert.equal(backup.media.length, 4);
  assert.equal(backup.stores.cms.revisions.length, 1);
  for (const file of backup.media) assert.equal(createHash("sha256").update(Buffer.from(file.data, "base64")).digest("hex"), file.sha256);
  const diskBackups = await readdir(join(source.directory, "backups"));
  assert.ok(diskBackups.some((name) => name.includes("publish")));
  assert.ok(diskBackups.some((name) => name.includes("export")));
  const disk = JSON.parse(await readFile(join(source.directory, "backups", diskBackups.find((name) => name.includes("publish"))), "utf8"));
  assert.equal(disk.encrypted, true);
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(encryptionKey).digest(), Buffer.from(disk.iv, "base64"));
  decipher.setAuthTag(Buffer.from(disk.tag, "base64"));
  const saved = JSON.parse(Buffer.concat([decipher.update(Buffer.from(disk.payload, "base64url")), decipher.final()]).toString("utf8"));
  assert.equal(saved.media.length, 4);
  assert.equal((await destination.api("/api/backup", "PUT", { backup, mode: "replace" })).status, 200);
  for (const file of backup.media) {
    const response = await fetch(`${destination.url}/media/${file.filename}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(file.data, "base64"));
  }
  const restored = await (await destination.api("/api/cms/draft")).json();
  assert.equal(restored.published.developments[0].image.focalPoint, "20% 75%");
  assert.deepEqual(restored.published.textOverrides, content.textOverrides);
  assert.deepEqual(restored.published.imageOverrides, content.imageOverrides);
  assert.equal((await destination.api("/api/backup", "PUT", { backup, mode: "merge" })).status, 200);
  const tampered = structuredClone(backup); tampered.media[0].sha256 = "0".repeat(64);
  assert.equal((await destination.api("/api/backup", "PUT", { backup: tampered })).status, 400);
  const traversal = structuredClone(backup); traversal.media[0].filename = "../content.json";
  assert.equal((await destination.api("/api/backup", "PUT", { backup: traversal })).status, 400);
  const missing = structuredClone(backup); missing.media.pop();
  assert.equal((await destination.api("/api/backup", "PUT", { backup: missing })).status, 400);
  const duplicate = structuredClone(backup); duplicate.media.push(duplicate.media[0]);
  assert.equal((await destination.api("/api/backup", "PUT", { backup: duplicate })).status, 400);
  assert.equal((await (await destination.api("/api/cms/draft")).json()).published.hero.title, second.hero.title);
  const unauthenticated = await fetch(`${source.url}/api/uploads/images`, { method: "POST", body: form });
  assert.equal(unauthenticated.status, 401);
  const malformed = new FormData(); malformed.set("image", new Blob(["not an image"], { type: "image/png" }), "broken.png");
  assert.equal((await source.api("/api/uploads/images", "POST", malformed)).status, 400);
});

test("contact enquiries are saved and queued; delivery status requires Studio authentication", async (t) => {
  const server = await startServer(t);
  assert.equal((await fetch(`${server.url}/api/contact/status`)).status, 401);
  const response = await fetch(`${server.url}/api/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Test Visitor", email: "visitor@example.com", type: "Development enquiry", message: "Please contact me about your development." }) });
  assert.equal(response.status, 202);
  const status = await (await server.api("/api/contact/status")).json();
  assert.equal(status.configured, false); assert.equal(status.pending, 1);
  const saved = JSON.parse((await readFile(join(server.directory, "leads", "contact.jsonl"), "utf8")).trim());
  assert.equal(saved.payload.email, "visitor@example.com"); assert.equal(saved.emailNotification, true);
});
test("backend publishes more than six projects and supports removing the final project", async (t) => {
  const server = await startServer(t);
  const content = structuredClone(defaultContent);
  content.developments.push({ ...structuredClone(content.developments[0]), id: "seventh-project", title: "Seventh project", ctaHref: "/developments/seventh-project" });
  assert.equal((await server.api("/api/cms/publish", "POST", { content })).status, 200);
  assert.equal((await (await server.api("/api/cms/draft")).json()).published.developments.length, 7);
  content.developments = [];
  assert.equal((await server.api("/api/cms/publish", "POST", { content })).status, 200);
  assert.equal((await (await server.api("/api/cms/draft")).json()).published.developments.length, 0);
  assert.equal((await fetch(`${server.url}/api/contact/verify`, { method: "POST" })).status, 401);
  const status = await (await server.api("/api/contact/verify", "POST")).json();
  assert.equal(status.configured, false); assert.equal(status.connection.verified, false);
});
