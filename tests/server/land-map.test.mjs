import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createTrackingSite } from "../../src/lib/trackingStorage.ts";

test("saved land selections persist, reach the same public QR token, survive backup restore and reject invalid coordinates", { timeout: 30000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-land-map-"));
  const child = spawn(process.execPath, ["server/secure-server.mjs"], {
    windowsHide: true, cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "0", KINGSVALE_DATA_DIR: directory, STUDIO_USER: "kingsvale", STUDIO_PASSWORD: "test-only-map-password", STUDIO_AUTH_TOKEN_SECRET: "test-only-map-token", CMS_ENCRYPTION_KEY: "test-only-map-encryption", STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "" }
  });
  t.after(async () => {
    if (child.exitCode === null) { const closed = new Promise((done) => child.once("exit", done)); child.kill(); await closed; }
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep + "kingsvale-land-map-"));
    await rm(target, { recursive: true, force: true });
  });
  const url = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on("data", (data) => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } });
  });
  const login = await fetch(`${url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "kingsvale", password: "test-only-map-password" }) });
  assert.equal(login.status, 200);
  const { authToken } = await login.json();
  const api = (path, method = "GET", body) => fetch(`${url}${path}`, { method, headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const polygon = { type: "Polygon", coordinates: [[[-0.84, 51.49], [-0.83, 51.49], [-0.83, 51.50], [-0.84, 51.49]]] };
  let site = { ...createTrackingSite(), reference: "KV-MAP-1", privateNotes: "not public", landMap: { version: 1, basemap: "satellite", boundary: [polygon], selection: [polygon], showBoundary: false } };
  assert.equal((await api("/api/tracking-sites", "PUT", { site })).status, 200);
  const qrPath = `/api/tracking-sites/${site.token}`;
  let response = await fetch(`${url}${qrPath}`);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(response.headers.get("Content-Security-Policy"), /server\.arcgisonline\.com/);
  let saved = (await response.json()).site;
  assert.deepEqual(saved.landMap.selection, [polygon]);
  assert.deepEqual(saved.landMap.boundary, []);
  assert.equal(saved.privateNotes, undefined);
  const { backup } = await (await api("/api/backup")).json();
  assert.deepEqual(backup.stores.tracking.sites[0].landMap.boundary, [polygon]);

  const modified = structuredClone(polygon); modified.coordinates[0][1][0] = -0.835;
  site = { ...site, landMap: { ...site.landMap, selection: [modified], showBoundary: true } };
  assert.equal((await api("/api/tracking-sites", "PUT", { site })).status, 200);
  saved = (await (await fetch(`${url}${qrPath}`)).json()).site;
  assert.deepEqual(saved.landMap.selection, [modified]);
  assert.deepEqual(saved.landMap.boundary, [polygon]);
  const invalid = structuredClone(site); invalid.landMap.selection[0].coordinates[0][1][0] = 999;
  assert.equal((await api("/api/tracking-sites", "PUT", { site: invalid })).status, 400);
  assert.deepEqual((await (await fetch(`${url}${qrPath}`)).json()).site.landMap.selection, [modified]);

  assert.equal((await api("/api/backup", "PUT", { backup, mode: "replace" })).status, 200);
  assert.deepEqual((await (await fetch(`${url}${qrPath}`)).json()).site.landMap.selection, [polygon]);
  assert.equal((await api(`/api/tracking-sites/${site.id}/archive`, "POST", {})).status, 200);
  assert.equal((await fetch(`${url}${qrPath}`)).status, 404);
});
