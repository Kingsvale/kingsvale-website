import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm, rmdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { defaultContent } from "../../src/data/defaultContent.ts";
import { createTrackingSite } from "../../src/lib/trackingStorage.ts";
import { createDocumentAccess } from "../../server/document-access.mjs";
import { createSearchIndexing } from "../../server/search-indexing.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-hardening-"));
  await mkdir(join(directory, "uploads")); await mkdir(join(directory, "cms")); await mkdir(join(directory, "tracking-sites"));
  const content = structuredClone(defaultContent); content.hero.image.src = "/media/legacy-public.png";
  const site = { ...createTrackingSite(), reference: "PRIVATE-TEST", titleDeedFileUrl: "/media/scanned-deed.png", titleDeedFileName: "Scanned deed.png" };
  await writeFile(join(directory, "cms/content.json"), JSON.stringify({ published: content, draft: content, revisions: [] }));
  await writeFile(join(directory, "tracking-sites/sites.json"), JSON.stringify({ sites: [site] }));
  for (const name of ["legacy-public.png", "private-garden-aaaaaaaaaaaaaaaaaaaaaaaa-960.webp", "scanned-deed.png", "orphan-scan.jpg", "old-letter.pdf"]) await writeFile(join(directory, "uploads", name), "private-test-data");
  let child, url, token, cookie;
  async function start() {
    child = spawn(process.execPath, ["server/secure-server.mjs"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: "0", KINGSVALE_DATA_DIR: directory, STUDIO_USER: "test", STUDIO_PASSWORD: "test-only-pass", STUDIO_AUTH_TOKEN_SECRET: "private-test-secret", CMS_ENCRYPTION_KEY: "", STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "", NODE_ENV: "test", TRUSTED_PROXY_CIDRS: "", CLIENT_IP_HEADER: "" } });
    let errors = ""; child.stderr.on("data", data => errors += data.toString());
    url = await new Promise((done, reject) => { const timer = setTimeout(() => reject(new Error(errors || "Timeout")), 10000); child.stdout.on("data", data => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } }); child.once("exit", code => { clearTimeout(timer); reject(new Error(`${code}: ${errors}`)); }); });
    const login = await fetch(url + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "test", password: "test-only-pass" }) });
    token = (await login.json()).authToken;
    cookie = login.headers.getSetCookie().find(value => value.startsWith("kingsvale_documents=")).split(";")[0];
  }
  async function stop() { if (child?.exitCode === null) { const exit = new Promise(done => child.once("exit", done)); child.kill(); await exit; } }
  t.after(async () => { await stop(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "kingsvale-hardening-")); await rm(directory, { recursive: true, force: true }); });
  await start();
  const request = (path, init = {}) => fetch(url + path, init);
  const api = (path, method = "GET", payload) => request(path, { method, headers: { Authorization: `Bearer ${token}`, ...(payload instanceof FormData ? {} : { "Content-Type": "application/json" }) }, ...(payload === undefined ? {} : { body: payload instanceof FormData ? payload : JSON.stringify(payload) }) });
  return { directory, site, content, api, request, cookie: () => cookie, restart: async () => { await stop(); await start(); } };
}

test("private documents, image scans, cookie delivery, ranges, expiring shares and backups", async t => {
  const f = await fixture(t);
  for (const path of ["/media/scanned-deed.png", "/media/orphan-scan.jpg", "/media/old-letter.pdf", "/media/%73canned-deed.png"]) {
    for (const method of ["GET", "HEAD"]) { const r = await f.request(path, { method }); assert.equal(r.status, 401); assert.match(r.headers.get("cache-control"), /no-store/); }
    assert.equal((await f.api(path)).status, 200);
  }
  assert.equal((await f.request("/media/legacy-public.png")).status, 200);
  assert.equal((await f.request("/media/private-garden-aaaaaaaaaaaaaaaaaaaaaaaa-960.webp")).status, 200, "A photograph of a private garden is still public website media");
  assert.equal((await f.request("/media/SCANNED-DEED.PNG")).status, 401, "Private classification must survive filesystem case aliases");
  const native = await f.request("/media/scanned-deed.png", { headers: { Cookie: f.cookie() } }); assert.equal(native.status, 200);
  const range = await f.request("/media/old-letter.pdf", { headers: { Cookie: f.cookie(), Range: "bytes=0-6" } }); assert.equal(range.status, 206); assert.equal(await range.text(), "private");
  assert.equal((await f.request("/media/old-letter.pdf", { headers: { Cookie: f.cookie(), Range: "bytes=999999-" } })).status, 416);
  assert.equal((await f.request("/api/tracking-sites", { headers: { Cookie: f.cookie() } })).status, 401, "Document cookie must never authenticate API writes or reads");
  assert.equal((await f.request("/media/scanned-deed.png", { headers: { Cookie: f.cookie() + "x" } })).status, 401);
  const refresh = await f.api("/api/auth/me"); assert.ok(refresh.headers.getSetCookie().some(value => value.includes("HttpOnly") && value.includes("SameSite=Strict") && value.includes("Path=/media/")));
  const form = new FormData(); form.set("file", new Blob(["private-new-scan"], { type: "image/png" }), "New scan.png");
  const upload = await f.api("/api/uploads/letters", "POST", form); assert.equal(upload.status, 201); const { file } = await upload.json();
  assert.equal((await f.request(file.url)).status, 401, "An uploaded scan is private before assignment");
  const shareResponse = await f.api("/api/studio/document-shares", "POST", { url: file.url, hours: 1 }); assert.equal(shareResponse.status, 201); const { share } = await shareResponse.json();
  const shared = await f.request(share.url); assert.equal(shared.status, 200); assert.equal(await shared.text(), "private-new-scan"); assert.match(shared.headers.get("cache-control"), /no-store/);
  assert.equal((await f.request(share.url + "/other.pdf")).status, 404);
  await f.restart(); assert.equal((await f.request(share.url)).status, 200);
  const { backup } = await (await f.api("/api/backup")).json();
  assert.ok(backup.stores.privateDocuments.files.includes(file.url.slice(7))); assert.ok(!JSON.stringify(backup).includes(share.url.slice(17)));
  const copy = await fixture(t);
  backup.stores.cms.pendingIndexingRoutes = ["/developments/removed-before-backup", "/track/never-submit-private"];
  // The QR key identity in a fixture is stable, allowing a portable test restore.
  assert.equal((await copy.api("/api/backup", "PUT", { backup, mode: "replace" })).status, 200);
  const restoredQueue = JSON.parse(await readFile(join(copy.directory, "private/search-indexing.json"), "utf8"));
  assert.ok(restoredQueue.pending.includes("https://www.kingsvalehomes.co.uk/developments/removed-before-backup"));
  assert.ok(!restoredQueue.pending.some(url => url.includes("never-submit-private")));
  assert.equal((await copy.request(file.url)).status, 401); assert.equal((await copy.api(file.url)).status, 200); assert.equal((await copy.request(share.url)).status, 404);
  await f.api("/api/studio/document-shares", "DELETE", { id: share.id }); assert.equal((await f.request(share.url)).status, 404);
  const old = structuredClone(backup); delete old.stores.privateDocuments;
  assert.equal((await copy.api("/api/backup", "PUT", { backup: old, mode: "merge" })).status, 200); assert.equal((await copy.request("/media/orphan-scan.jpg")).status, 401);
  const broken = structuredClone(backup); broken.stores.privateDocuments.files.push("../secret.pdf");
  assert.equal((await copy.api("/api/backup", "PUT", { backup: broken })).status, 400);
  const logout = await f.api("/api/auth/logout", "POST", {}); assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
});

test("sitemap follows publication rather than drafts and missing pages return real 404 responses", async t => {
  const f = await fixture(t);
  for (const path of ["/not-a-real-page", "/developments/missing", `/developments/${f.content.developments[0].id}/extra`, "/track/missing"]) {
    const r = await f.request(path); assert.equal(r.status, 404); assert.match(r.headers.get("x-robots-tag"), /noindex/);
  }
  const next = structuredClone(f.content); next.developments[0].ctaHref = "/developments/new-published-project";
  await f.api("/api/cms/draft", "PUT", { content: next });
  assert.ok(!(await (await f.request("/sitemap.xml")).text()).includes("new-published-project"));
  const published = await f.api("/api/cms/publish", "POST", { content: next }); assert.equal(published.status, 200);
  const sitemap = await (await f.request("/sitemap.xml")).text(); assert.ok(sitemap.includes("new-published-project")); assert.match(sitemap, /<lastmod>\d{4}-/); assert.ok(!sitemap.includes("/track/") && !sitemap.includes("/studio"));
  assert.equal((await f.request("/developments/new-published-project")).status, 200);
  assert.equal((await f.request("/developments/new-published-project/", { redirect: "manual" })).status, 308);
  const edited = structuredClone(next); edited.hero.subtitle = "A draft not yet published.";
  await f.api("/api/cms/draft", "PUT", { content: edited });
  assert.equal(await (await f.request("/sitemap.xml")).text(), sitemap, "Draft edits cannot advance publication dates");
  const state = await (await f.api("/api/cms/indexing")).json(); assert.ok(state.queued > 0); assert.equal(state.enabled, false);
});

test("document shares expire and indexing retries preserve an in-flight newer publication", async t => {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-hardening-modules-")); await mkdir(join(directory, "uploads"));
  t.after(async () => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "kingsvale-hardening-modules-")); await rm(directory, { recursive: true, force: true }); });
  const options = { directory, uploads: join(directory, "uploads"), encode: JSON.stringify, decode: JSON.parse, secret: "test" };
  const docs = createDocumentAccess(options); await docs.initialize([]); await docs.protect(["private-test.pdf"]); const share = await docs.createShare("private-test.pdf", 1);
  const stored = JSON.parse(await readFile(join(directory, "private/document-access.json"), "utf8")); stored.shares[0].expiresAt = "2020-01-01T00:00:00Z"; await writeFile(join(directory, "private/document-access.json"), JSON.stringify(stored));
  const reloaded = createDocumentAccess(options); await reloaded.initialize([]); assert.equal(reloaded.sharedFile(share.url.split("/").at(-1)), null);
  let respond, started; const arrived = new Promise(done => started = done);
  const receiver = createServer((req, res) => { req.resume(); respond = () => { res.statusCode = 202; res.end(); }; started(); }); await new Promise(done => receiver.listen(0, "127.0.0.1", done));
  t.after(() => new Promise(done => receiver.close(done)));
  const indexing = await createSearchIndexing({ ...options, origin: "https://www.kingsvalehomes.co.uk", enabled: true, endpoint: `http://127.0.0.1:${receiver.address().port}` });
  await indexing.enqueue(["/developments/one"]); const sending = indexing.tick(); await arrived; await indexing.enqueue(["/developments/one"]); respond(); await sending;
  assert.equal(indexing.status().queued, 1); assert.ok(indexing.status().lastSubmittedAt);
});

test("publication outbox recovers new and removed routes after queue failure and restart", async t => {
  const f = await fixture(t);
  const queueFile = join(f.directory, "private", "search-indexing.json");
  // A directory in place of the queue file simulates a persistence failure.
  await mkdir(queueFile);
  const next = structuredClone(f.content);
  const previousPath = next.developments[0].ctaHref;
  next.developments[0].ctaHref = "/developments/recovered-publication";
  assert.equal((await f.api("/api/cms/publish", "POST", { content: next })).status, 200);
  const saved = JSON.parse(await readFile(join(f.directory, "cms/content.json"), "utf8"));
  assert.ok(saved.pendingIndexingRoutes.includes(previousPath));
  assert.ok(saved.pendingIndexingRoutes.includes("/developments/recovered-publication"));
  await rmdir(queueFile);
  await f.restart();
  const recovered = JSON.parse(await readFile(queueFile, "utf8"));
  assert.ok(recovered.pending.includes("https://www.kingsvalehomes.co.uk" + previousPath));
  assert.ok(recovered.pending.includes("https://www.kingsvalehomes.co.uk/developments/recovered-publication"));
  assert.deepEqual(JSON.parse(await readFile(join(f.directory, "cms/content.json"), "utf8")).pendingIndexingRoutes, []);
});
