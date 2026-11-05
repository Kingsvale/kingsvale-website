import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { editLetterParagraphs, extractLetterParagraphs, generateLetterDocx, createTrackingQrPng } from "../../server/letter-generator.mjs";
import { letterContent, saveEditedLetter } from "../../server/letter-editor.mjs";
import { createTrackingSite } from "../../src/lib/trackingStorage.ts";

test("saved letter edits round-trip text while preserving artwork, relationships and Word styles", async () => {
  for (const stage of ["initial", "follow-up"]) {
    const buffer = await readFile(`public/templates/kingsvale-${stage}-letter-template.docx`);
    const paragraphs = extractLetterParagraphs(buffer);
    const greeting = paragraphs.find((item) => item.text.startsWith("Dear "));
    assert.ok(greeting);
    for (const text of ["Dear Amy Example,", "Dear Sir/Madam, and family", "Dear Sir/Madam", "", "A & B <land> \"title\"\nSecond line\tTabbed", "Dear 🙂 Example,"]) {
      const edited = editLetterParagraphs(buffer, [{ id: greeting.id, text }]);
      const result = extractLetterParagraphs(edited);
      assert.equal(result.find((item) => item.id === greeting.id)?.text ?? "", text);
      assert.deepEqual(result.filter((item) => item.id !== greeting.id), paragraphs.filter((item) => item.id !== greeting.id));
      const sourceFiles = unzip(buffer);
      const editedFiles = unzip(edited);
      assert.deepEqual([...editedFiles.keys()], [...sourceFiles.keys()]);
      for (const [name, bytes] of sourceFiles) {
        if (name !== "word/document.xml") assert.deepEqual(editedFiles.get(name), bytes, name);
      }
      const formatting = (files) => [...files.get("word/document.xml").toString().matchAll(/<w:rPr\b[\s\S]*?<\/w:rPr>|<w:pPr\b[\s\S]*?<\/w:pPr>|<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)].map((match) => match[0]);
      assert.deepEqual(formatting(editedFiles), formatting(sourceFiles));
    }
    const words = paragraphs.find((item) => item.text.length > 100);
    let edited = editLetterParagraphs(buffer, [{ id: words.id, text: `${words.text}\nAn additional paragraph.` }]);
    edited = editLetterParagraphs(edited, [{ id: words.id, text: "Replacement text." }]);
    assert.equal(extractLetterParagraphs(edited).find((item) => item.id === words.id).text, "Replacement text.");
  }
});

test("editor validates changes before invoking conversion", async () => {
  const buffer = await readFile("public/templates/kingsvale-initial-letter-template.docx");
  const { version, paragraphs } = letterContent(buffer);
  const id = paragraphs[0].id;
  for (const payload of [
    { version: "old", changes: [{ id, text: "test" }] }, { version, changes: [] },
    { version, changes: [{ id: 100000, text: "test" }] }, { version, changes: [{ id, text: "x".repeat(12001) }] },
    { version, changes: [{ id, text: "\u0000" }] }, { version, changes: [{ id, text: 123 }] },
    { version, changes: [{ id, text: "one" }, { id, text: "two" }] }
  ]) await assert.rejects(saveEditedLetter(buffer, payload, "unused"), { code: "LETTER_EDIT_INVALID" });
});

test("letter editor API requires authentication and saves matching Word/PDF without changing the source", { timeout: 90000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "kingsvale-letter-edit-"));
  await mkdir(join(directory, "uploads"));
  const site = { ...createTrackingSite(), customerName: "Amy Example", letterRecipientMode: "title-owner" };
  const original = generateLetterDocx(await readFile("public/templates/kingsvale-initial-letter-template.docx"), site, "https://example.com/track/test", await createTrackingQrPng("https://example.com/track/test"));
  await writeFile(join(directory, "uploads", "original.docx"), original);
  const child = spawn(process.execPath, ["server/secure-server.mjs"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "0", KINGSVALE_DATA_DIR: directory, STUDIO_USER: "kingsvale", STUDIO_PASSWORD: "test-editor-password", STUDIO_AUTH_TOKEN_SECRET: "test-editor-auth", CMS_ENCRYPTION_KEY: "test-editor-encryption", STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "" } });
  t.after(async () => {
    if (child.exitCode === null) { const closed = new Promise((done) => child.once("exit", done)); child.kill(); await closed; }
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "kingsvale-letter-edit-"));
    await rm(directory, { recursive: true, force: true });
  });
  const url = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}`)); });
    child.stdout.on("data", (data) => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } });
  });
  for (const endpoint of ["content", "edit"]) assert.equal((await fetch(`${url}/api/letters/${endpoint}`, { method: "POST" })).status, 401);
  const { authToken } = await (await fetch(`${url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "kingsvale", password: "test-editor-password" }) })).json();
  const api = (action, body) => fetch(`${url}/api/letters/${action}`, { method: "POST", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  for (const source of ["https://example.com/x.docx", "/media/../secret.docx", "/media/original.pdf"]) assert.equal((await api("content", { url: source })).status, 400);
  const response = await api("content", { url: "/media/original.docx" });
  assert.equal(response.status, 200);
  const content = await response.json();
  const id = content.paragraphs.find((item) => item.text.startsWith("Dear ")).id;
  const bodyId = content.paragraphs.find((item) => item.text.startsWith("I am writing")).id;
  assert.equal((await api("edit", { url: "/media/original.docx", version: "old", changes: [{ id, text: "Dear Amy Example," }] })).status, 400);
  if (process.platform === "win32" && !process.env.LIBREOFFICE_PATH) { t.diagnostic("PDF conversion requires LIBREOFFICE_PATH on Windows; production CI exercises conversion."); return; }
  const saved = await api("edit", { url: "/media/original.docx", name: "test-letter.docx", version: content.version, changes: [{ id, text: "Dear Amy Example," }, { id: bodyId, text: "A personal note about your property.\nPlease contact us when convenient." }] });
  assert.equal(saved.status, 201, await saved.clone().text());
  const { file } = await saved.json();
  assert.equal(file.name, "test-letter.docx");
  assert.equal(file.documents[0].kind, "letter-pdf");
  const edited = await readFile(join(directory, "uploads", file.url.slice(7)));
  assert.equal(extractLetterParagraphs(edited).find((item) => item.id === id).text, "Dear Amy Example,");
  assert.equal((await readFile(join(directory, "uploads", file.documents[0].url.slice(7)))).subarray(0, 5).toString(), "%PDF-");
  if (process.platform !== "win32" || process.env.PDFTOTEXT_PATH) {
    const { stdout } = await promisify(execFile)(process.env.PDFTOTEXT_PATH || "pdftotext", [join(directory, "uploads", file.documents[0].url.slice(7)), "-"], { windowsHide: true });
    assert.match(stdout, /Dear Amy Example,/);
    assert.match(stdout, /A personal note about your property\./);
    assert.doesNotMatch(stdout, /Dear Sir\/Madam/);
  }
  assert.deepEqual(await readFile(join(directory, "uploads", "original.docx")), original);
});

function unzip(buffer) {
  const files = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    const bytes = buffer.subarray(start, start + size);
    files.set(name, buffer.readUInt16LE(offset + 8) === 8 ? inflateRawSync(bytes) : bytes);
    offset = start + size;
  }
  return files;
}
