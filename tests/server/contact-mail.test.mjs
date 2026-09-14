import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createContactMailer } from "../../server/contact-mail.mjs";
const env = { SMTP_USER: "enquiries@kingsvalehomes.co.uk", SMTP_PASSWORD: "test-only" };
const lead = { id: "test-contact-1", createdAt: "2026-09-14T12:00:00Z", emailNotification: true, payload: { name: "Test visitor", email: "visitor@example.com", message: "Please contact me about a project." } };
async function folder(t) {
  const path = await mkdtemp(join(tmpdir(), "kingsvale-email-"));
  t.after(async () => { assert.ok(resolve(path).startsWith(resolve(tmpdir()) + sep + "kingsvale-email-")); await rm(path, { recursive: true, force: true }); });
  await writeFile(join(path, "contact.jsonl"), JSON.stringify(lead) + "\n" + JSON.stringify(lead) + "\n");
  return path;
}
test("email sends to the business inbox with visitor reply-to and survives restart without duplicate delivery", async (t) => {
  const path = await folder(t); const messages = [];
  const transport = { sendMail: async (mail) => { messages.push(mail); return { accepted: [env.SMTP_USER] }; } };
  const mailer = createContactMailer(path, env, transport);
  await Promise.all([mailer.flush(), mailer.flush()]);
  assert.equal(messages.length, 1); assert.equal(messages[0].to, env.SMTP_USER);
  assert.equal(messages[0].replyTo, lead.payload.email); assert.match(messages[0].text, /Please contact me/);
  await createContactMailer(path, env, transport).flush(); assert.equal(messages.length, 1);
  assert.equal((await mailer.status()).pending, 0);
});
test("missing credentials retain enquiries; failures back off and retry successfully", async (t) => {
  const path = await folder(t);
  const unconfigured = createContactMailer(path, {}); await unconfigured.flush();
  assert.equal((await unconfigured.status()).configured, false); assert.equal((await unconfigured.status()).pending, 1);
  let calls = 0;
  const mailer = createContactMailer(path, env, { sendMail: async () => { calls++; if (calls === 1) throw new Error("private credentials must not be logged"); return { accepted: [env.SMTP_USER] }; } });
  await mailer.flush(); await mailer.flush(); assert.equal(calls, 1);
  const file = join(path, "email-delivery.jsonl");
  const raw = await readFile(file, "utf8"); assert.ok(!raw.includes("private credentials"));
  const entry = JSON.parse(raw.trim()); entry.retryAt = "2020-01-01T00:00:00Z";
  await writeFile(file, JSON.stringify(entry) + "\n"); await mailer.flush();
  assert.equal(calls, 2); assert.equal((await mailer.status()).pending, 0);
});
