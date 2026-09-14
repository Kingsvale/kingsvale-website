import nodemailer from "nodemailer";
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

export function createContactMailer(directory, env = process.env, injectedTransport) {
  const user = env.SMTP_USER?.trim();
  const password = (env.SMTP_HOST || "smtp.gmail.com") === "smtp.gmail.com" ? env.SMTP_PASSWORD?.replace(/\s/g, "") : env.SMTP_PASSWORD;
  const to = env.CONTACT_EMAIL_TO || "enquiries@kingsvalehomes.co.uk";
  const from = env.CONTACT_EMAIL_FROM || user;
  const configured = Boolean(user && password && from && to);
  const port = Number(env.SMTP_PORT || 465);
  const transport = injectedTransport ?? (configured ? nodemailer.createTransport({
    host: env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465,
    requireTLS: true, auth: { user, pass: password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true
  }) : null);
  let running = null;
  let connection = null;
  const errorMessages = {
    EAUTH: "Google rejected the sign-in. Use a Google app password for the sending mailbox, not its normal password.",
    ETIMEDOUT: "The email server timed out. Check outbound SMTP access from the hosting server.",
    ECONNECTION: "The hosting server could not connect to the email server. Check SMTP_HOST, SMTP_PORT and outbound network access.",
    ESOCKET: "The secure SMTP connection failed. Check the server address, port and certificate configuration.",
    EDNS: "The email server address could not be resolved. Check SMTP_HOST and the hosting server’s DNS.",
    EENVELOPE: "The email server rejected a sending or receiving address. Check the mailbox and any approved sending alias.",
    UNKNOWN: "Email delivery failed. Check the SMTP settings and try the connection check. Saved enquiries will retry automatically."
  };
  const safeErrorCode = (error) => Object.hasOwn(errorMessages, error?.code) ? error.code : "UNKNOWN";
  async function verify() {
    if (!transport) { connection = { verified: false, code: "NOT_CONFIGURED" }; return status(); }
    try { await transport.verify(); connection = { verified: true, code: null }; }
    catch (error) { connection = { verified: false, code: safeErrorCode(error) }; }
    return status();
  }
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
    const failureCode = connection?.verified === false ? connection.code : latest?.status === "failed" ? latest.code || "UNKNOWN" : null;
    return { configured, connection, recipient: to, sender: from || "Not configured", pending: leads.filter((record) => deliveries.get(record.id)?.status !== "sent").length,
      lastAttempt: latest?.at ?? null, lastStatus: latest?.status ?? null,
      message: !configured ? "Email setup required. Set SMTP_USER and SMTP_PASSWORD on the server. Enquiries are saved and queued until setup is complete." : failureCode && failureCode !== "NOT_CONFIGURED" ? errorMessages[failureCode] : "Email delivery is configured. New enquiries are saved before being sent." };
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
      } catch (error) {
        entry = { id: record.id, status: "failed", code: safeErrorCode(error), attempt, at: new Date().toISOString(), retryAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(attempt - 1, 6))).toISOString() };
      }
      await appendFile(journal, JSON.stringify(entry) + "\n");
    }
  }
  function flush() { if (!running) running = drain().finally(() => { running = null; }); return running; }
  return { flush, status, verify };
}
