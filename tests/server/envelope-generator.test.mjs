import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createTrackingSite } from "../../src/lib/trackingStorage.ts";
import { extractLetterParagraphs } from "../../server/letter-generator.mjs";
import { regenerateEnvelopeDocuments } from "../../server/envelope-generator.mjs";

test("envelope generation requires a recipient address before writing files", async () => {
  const template = await readFile("public/templates/kingsvale-envelope-template.docx");
  await assert.rejects(regenerateEnvelopeDocuments(template, { siteAddress: "", siteAddressParts: {} }, "unused"), { code: "ENVELOPE_ADDRESS" });
});

test("authenticated envelope regeneration uses saved mailing details and preserves existing letters", { timeout: 60000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-envelope-"));
  await mkdir(join(directory, "uploads"));
  const originalLetter = await readFile("public/templates/kingsvale-initial-letter-template.docx");
  await writeFile(join(directory, "uploads", "existing-letter.docx"), originalLetter);
  const child = spawn(process.execPath, ["server/secure-server.mjs"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "0", KINGSVALE_DATA_DIR: directory, STUDIO_USER: "kingsvale", STUDIO_PASSWORD: "test-envelope-password", STUDIO_AUTH_TOKEN_SECRET: "test-envelope-token", CMS_ENCRYPTION_KEY: "test-envelope-encryption", STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "" } });
  t.after(async () => {
    if (child.exitCode === null) { const closed = new Promise((done) => child.once("exit", done)); child.kill(); await closed; }
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "kingsvale-envelope-"));
    await rm(directory, { recursive: true, force: true });
  });
  const url = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}`)); });
    child.stdout.on("data", (data) => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } });
  });
  assert.equal((await fetch(`${url}/api/letters/envelopes`, { method: "POST" })).status, 401);
  const { authToken } = await (await fetch(`${url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "kingsvale", password: "test-envelope-password" }) })).json();
  const api = (path, method = "GET", body) => fetch(`${url}${path}`, { method, headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal((await api("/api/letters/envelopes")).status, 405);
  assert.equal((await api("/api/letters/envelopes", "POST", { siteId: "missing" })).status, 404);
  const site = { ...createTrackingSite(), reference: "KV-ENV-1", customerName: "Updated Owner", letterRecipientMode: "title-owner", siteAddress: "12 Updated Road, London, SW2 2TB",
    siteAddressParts: { line1: "12 Updated Road", line2: "", town: "London", county: "", postcode: "SW2 2TB" },
    letterFileName: "personal-letter.docx", letterFileUrl: "/media/existing-letter.docx", firstMailedAt: "2026-11-01", lastMailedAt: "2026-11-03", remailReminderDate: "2026-11-17",
    letterDocuments: [{ kind: "letter-pdf", name: "personal-letter.pdf", url: "/media/existing-letter.pdf" }, { kind: "envelope-pdf", name: "old-envelope.pdf", url: "/media/old-envelope.pdf" }] };
  const savedResponse = await api("/api/tracking-sites", "PUT", { site });
  assert.equal(savedResponse.status, 200, await savedResponse.clone().text());
  const saved = (await savedResponse.json()).site;
  if (process.platform === "win32" && !process.env.LIBREOFFICE_PATH) { t.diagnostic("PDF conversion requires LIBREOFFICE_PATH on Windows; production CI exercises conversion."); return; }
  const response = await api("/api/letters/envelopes", "POST", { siteId: site.id });
  assert.equal(response.status, 201, await response.clone().text());
  const { documents } = await response.json();
  assert.deepEqual(documents.map((document) => document.kind), ["envelope-docx", "envelope-pdf"]);
  const word = await readFile(join(directory, "uploads", documents[0].url.slice(7)));
  const text = extractLetterParagraphs(word).map((paragraph) => paragraph.text).join("\n");
  assert.match(text, /Updated Owner/);
  assert.match(text, /12 Updated Road/);
  assert.match(text, /SW2 2TB/);
  assert.doesNotMatch(text, /\{\{/);
  assert.doesNotMatch(text, /Return Address|Kingsvale Ltd|Shelton Street|WC2H 9JQ/);
  const { stdout } = await promisify(execFile)("pdfinfo", [join(directory, "uploads", documents[1].url.slice(7))], { windowsHide: true });
  assert.match(stdout, /Pages:\s+1/);
  assert.match(stdout, /Page size:\s+649\.[\d]+ x 459\.[\d]+ pts/);
  assert.deepEqual(await readFile(join(directory, "uploads", "existing-letter.docx")), originalLetter);
  const loaded = (await (await api("/api/tracking-sites")).json()).sites[0];
  assert.deepEqual(loaded, saved, "Creating replacements must not mutate the letter or mailing record");
  assert.equal((await readdir(join(directory, "uploads"))).length, 3);
});
