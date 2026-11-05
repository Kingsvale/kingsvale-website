import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createTrackingSite } from "../../src/lib/trackingStorage.ts";

test("shared notes migrate existing storage, persist edits and clearing, stay private and survive backups", { timeout: 30000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-notes-"));
  const legacy = { ...createTrackingSite(), reference: "KV-NOTES-1", privateNotes: "S".repeat(1200), mailingNotes: "M".repeat(1200) };
  await mkdir(join(directory, "tracking-sites"));
  await writeFile(join(directory, "tracking-sites", "sites.json"), JSON.stringify({ sites: [legacy] }));
  const child = spawn(process.execPath, ["server/secure-server.mjs"], {
    windowsHide: true, cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "0", KINGSVALE_DATA_DIR: directory, STUDIO_USER: "kingsvale", STUDIO_PASSWORD: "test-only-notes-password", STUDIO_AUTH_TOKEN_SECRET: "test-only-notes-token", CMS_ENCRYPTION_KEY: "test-only-notes-encryption", STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "" }
  });
  t.after(async () => {
    if (child.exitCode === null) { const closed = new Promise((done) => child.once("exit", done)); child.kill(); await closed; }
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep + "kingsvale-notes-"));
    await rm(target, { recursive: true, force: true });
  });
  const url = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on("data", (data) => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } });
  });
  const login = await fetch(`${url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "kingsvale", password: "test-only-notes-password" }) });
  assert.equal(login.status, 200);
  const { authToken } = await login.json();
  const api = (path, method = "GET", body) => fetch(`${url}${path}`, { method, headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const load = async () => (await (await api("/api/tracking-sites")).json()).sites[0];
  const save = async (site) => { const response = await api("/api/tracking-sites", "PUT", { site }); assert.equal(response.status, 200); return (await response.json()).site; };

  let site = await load();
  const combined = `${legacy.privateNotes}\n\n${legacy.mailingNotes}`;
  assert.equal(site.privateNotes, combined);
  assert.equal(site.mailingNotes, combined);
  site = await save(site);
  assert.equal((await load()).privateNotes, combined);
  const stored = JSON.parse(await readFile(join(directory, "tracking-sites", "sites.json"), "utf8"));
  assert.equal(stored.encrypted, true);
  site = await save({ ...site, privateNotes: "Edited in Sites" });
  assert.equal(site.mailingNotes, "Edited in Sites");
  site = await save({ ...site, mailingNotes: "Edited in Mailing" });
  assert.equal((await load()).privateNotes, "Edited in Mailing");
  const { backup } = await (await api("/api/backup")).json();
  assert.equal(backup.stores.tracking.sites[0].privateNotes, "Edited in Mailing");
  assert.equal(backup.stores.tracking.sites[0].mailingNotes, "Edited in Mailing");
  for (const field of ["privateNotes", "mailingNotes"]) {
    site = await save({ ...site, [field]: "" });
    assert.equal((await load()).privateNotes, "");
    assert.equal((await load()).mailingNotes, "");
    site = await save({ ...site, privateNotes: "Restored note", mailingNotes: "Restored note" });
  }
  assert.equal((await api("/api/backup", "PUT", { backup, mode: "replace" })).status, 200);
  site = await load();
  assert.equal(site.privateNotes, "Edited in Mailing");
  assert.equal(site.mailingNotes, site.privateNotes);
  for (const endpoint of [`/api/tracking-sites/${site.token}`, "/api/tracking-sites/lookup"]) {
    const response = endpoint.endsWith("lookup")
      ? await api(endpoint, "POST", { reference: site.reference, postcode: site.siteAddressParts.postcode })
      : await fetch(`${url}${endpoint}`);
    assert.equal(response.status, 200);
    const publicSite = (await response.json()).site;
    assert.equal(publicSite.privateNotes, undefined);
    assert.equal(publicSite.mailingNotes, undefined);
  }
  assert.equal((await api("/api/tracking-sites", "PUT", { site: { ...site, privateNotes: 123 } })).status, 400);
  assert.equal((await api("/api/tracking-sites", "PUT", { site: { ...site, privateNotes: "x".repeat(3001), mailingNotes: "x".repeat(3001) } })).status, 400);
});
