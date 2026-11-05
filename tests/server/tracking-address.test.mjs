import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createTrackingSite } from "../../src/lib/trackingStorage.ts";
import { buildLetterTokens } from "../../server/letter-generator.mjs";

test("separate land addresses survive save and backup without leaking correspondence or breaking lookup and letters", { timeout: 30000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-address-"));
  const child = spawn(process.execPath, ["server/secure-server.mjs"], {
    windowsHide: true, cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "0", KINGSVALE_DATA_DIR: directory, STUDIO_USER: "kingsvale", STUDIO_PASSWORD: "test-only-address-password", STUDIO_AUTH_TOKEN_SECRET: "test-only-address-token", CMS_ENCRYPTION_KEY: "test-only-address-encryption", STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "" }
  });
  t.after(async () => {
    if (child.exitCode === null) { const closed = new Promise((done) => child.once("exit", done)); child.kill(); await closed; }
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep + "kingsvale-address-"));
    await rm(target, { recursive: true, force: true });
  });
  const url = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on("data", (data) => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } });
  });
  const login = await fetch(`${url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "kingsvale", password: "test-only-address-password" }) });
  assert.equal(login.status, 200);
  const { authToken } = await login.json();
  const api = (path, method = "GET", body) => fetch(`${url}${path}`, { method, headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const site = {
    ...createTrackingSite(), reference: "KV0114",
    siteAddress: "5 Brailsford Road, London, SW2 2TB",
    siteAddressParts: { line1: "5 Brailsford Road", line2: "", town: "London", county: "", postcode: "SW2 2TB" }
  };
  const qrPath = `/api/tracking-sites/${site.token}`;
  const save = (record) => api("/api/tracking-sites", "PUT", { site: record });
  const publicSite = async () => (await (await fetch(`${url}${qrPath}`)).json()).site;
  const lookup = (postcode) => api("/api/tracking-sites/lookup", "POST", { reference: site.reference, postcode });

  // Existing records keep their current QR address until an override is entered.
  delete site.landAddress;
  assert.equal((await save(site)).status, 200);
  assert.equal((await publicSite()).siteAddress, site.siteAddress);
  site.landAddress = "Land adjacent to 5, Newnham Lane, Old Basing, RG24 7AT";
  assert.equal((await save(site)).status, 200);
  const result = await publicSite();
  assert.equal(result.siteAddress, site.landAddress);
  assert.equal(result.siteAddressParts.postcode, "RG24 7AT");
  assert.ok(!JSON.stringify(result).includes("Brailsford"));
  assert.ok(!JSON.stringify(result).includes("SW2 2TB"));
  assert.equal((await lookup("SW2 2TB")).status, 200);
  assert.equal((await lookup("RG24 7AT")).status, 404);
  const saved = (await (await api("/api/tracking-sites")).json()).sites[0];
  assert.equal(saved.siteAddress, site.siteAddress);
  assert.equal(saved.landAddress, site.landAddress);
  const tokens = buildLetterTokens(saved, "https://example.com/track");
  assert.equal(tokens.get("{{full_address}}"), site.siteAddress);
  assert.equal(tokens.get("{{postal_code}}"), "SW2 2TB");
  assert.equal(tokens.get("{{site_address}}"), site.landAddress);
  const landTokens = buildLetterTokens({ ...saved, letterRecipientMode: "plot-land" }, "");
  assert.equal(landTokens.get("{{postal_code}}"), "RG24 7AT");

  const { backup } = await (await api("/api/backup")).json();
  assert.equal((await save({ ...site, landAddress: "" })).status, 200);
  assert.equal((await publicSite()).siteAddress, site.siteAddress);
  assert.equal((await api("/api/backup", "PUT", { backup, mode: "replace" })).status, 200);
  assert.equal((await publicSite()).siteAddress, site.landAddress);
  assert.equal((await save({ ...site, landAddress: "x".repeat(221) })).status, 400);
  assert.equal((await save({ ...site, landAddress: 123 })).status, 400);
  assert.equal((await publicSite()).siteAddress, site.landAddress);
});
