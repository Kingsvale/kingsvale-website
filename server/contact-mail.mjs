import nodemailer from "nodemailer";
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

export function createContactMailer(directory, env = process.env, injectedTransport) {
  const user = env.SMTP_USER?.trim();
  const to = env.CONTACT_EMAIL_TO || "enquiries@kingsvalehomes.co.uk";
  const from = env.CONTACT_EMAIL_FROM || user;
  const configured = Boolean(user && env.SMTP_PASSWORD && from && to);
  const port = Number(env.SMTP_PORT || 465);
  const transport = injectedTransport ?? (configured ? nodemailer.createTransport({
    host: env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465,
    requireTLS: true, auth: { user, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true
  }) : null);
  let running = null;
  const journal = join(directory, "email-delivery.jsonl");
  async function records(file) {
    let raw;
    try { raw = await readFile(file, "utf8"); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    return raw.split("\n").filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  }
  async function state() {
    const leads = [...new Map((await records(join(directory, "contact.jsonl"))).filter((record) => record.emailNotification).map((record) => [record.id, record])).values()];
    const deliveries = new Map();
    for (const item of await records(journal)) { if (deliveries.get(item.id)?.status !== "sent") deliveries.set(item.id, item); }
    return { leads, deliveries };
  }
  async function status() {
    const { leads, deliveries } = await state();
    const latest = [...deliveries.values()].sort((a, b) => String(a.at).localeCompare(String(b.at))).at(-1);
    return { configured, recipient: to, sender: from || "Not configured", pending: leads.filter((record) => deliveries.get(record.id)?.status !== "sent").length,
      lastAttempt: latest?.at ?? null, lastStatus: latest?.status ?? null,
      message: !configured ? "Email setup required. Set SMTP_USER and SMTP_PASSWORD on the server. Enquiries are saved and queued until setup is complete." : latest?.status === "failed" ? "Email delivery failed. Check your Google app password and SMTP settings. Saved enquiries will retry automatically." : "Email delivery is configured. New enquiries are saved before being sent." };
  }
  async function drain() {
    if (!transport) return;
    const { leads, deliveries } = await state();
    const pending = leads.filter((record) => { const last = deliveries.get(record.id); return last?.status !== "sent" && (!last?.retryAt || Date.parse(last.retryAt) <= Date.now()); }).slice(0, 10);
    for (const record of pending) {
      const attempt = (deliveries.get(record.id)?.attempt ?? 0) + 1;
      let entry;
      try {
        const email = String(record.payload.email || "").trim();
        const result = await transport.sendMail({ from: { name: "Kingsvale Homes website", address: from }, to,
          replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
          subject: "New Kingsvale website enquiry",
          text: `Website enquiry ${record.id}\nReceived: ${record.createdAt}\n\n` + Object.entries(record.payload).filter(([key]) => key !== "website").map(([key, value]) => `${key}: ${String(value)}`).join("\n\n"),
          messageId: `<enquiry-${record.id}@kingsvalehomes.co.uk>` });
        if (!result.accepted?.length) throw new Error("No recipient accepted");
        entry = { id: record.id, status: "sent", attempt, at: new Date().toISOString() };
      } catch {
        entry = { id: record.id, status: "failed", attempt, at: new Date().toISOString(), retryAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(attempt - 1, 6))).toISOString() };
      }
      await appendFile(journal, JSON.stringify(entry) + "\n");
    }
  }
  function flush() { if (!running) running = drain().finally(() => { running = null; }); return running; }
  return { flush, status };
}
