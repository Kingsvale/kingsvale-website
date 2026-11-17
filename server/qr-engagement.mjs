import { readFile } from "node:fs/promises";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { atomicWrite, revisionOf } from "./state-store.mjs";
import { normalizeIp, resolveClientAddress, networkAddress } from "./client-address.mjs";

const cookieName = "kingsvale_editor_visit";
const days = 180;
export function createQrEngagement({ directory, secret, encode, decode, publicSite }) {
  const file = join(directory, "qr-engagement.json");
  const hmac = text => createHmac("sha256", secret).update(text).digest("hex");
  const keyId = hmac("qr-key-identity");
  const fingerprint = ip => hmac(`qr-network:${networkAddress(ip)}`);
  async function read() {
    try { return { ...decode(await readFile(file, "utf8")), keyId }; }
    catch (error) { if (error.code === "ENOENT") return { keyId, exclusions: [], sites: {} }; throw error; }
  }
  const write = store => atomicWrite(file, encode(store));
  function isEditor(request) {
    const value = String(request.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!value) return false;
    const [expiry, signature = ""] = value.split(".");
    const expected = hmac(`editor:${expiry}`);
    return /^\d{13}$/.test(expiry) && Number(expiry) > Date.now() && /^[a-f0-9]{64}$/.test(signature) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
  async function rememberEditor(request, response) {
    const expiry = String(Date.now() + days * 86400000);
    response.setHeader("Set-Cookie", `${cookieName}=${expiry}.${hmac(`editor:${expiry}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    const address = resolveClientAddress(request);
    if (address.reliable && address.ip) await exclude(request, { label: "Studio network", automatic: true });
  }
  async function exclude(request, { ip, label = "My network", automatic = false } = {}) {
    const current = resolveClientAddress(request);
    const selected = ip ? normalizeIp(ip) : current.reliable ? current.ip : null;
    if (!selected) throw Object.assign(new Error("The visitor IP is unavailable. Configure trusted proxies before excluding this network."), { status: 422 });
    const store = await read();
    const hash = fingerprint(selected);
    const found = store.exclusions.find(x => x.hash === hash);
    if (found) { if (!automatic) { found.label = String(label).trim().slice(0, 80) || "My network"; found.automatic = false; } }
    else {
      if (store.exclusions.length >= 100) {
        if (automatic) { const oldest = store.exclusions.find(x => x.automatic); if (!oldest) return; store.exclusions = store.exclusions.filter(x => x.id !== oldest.id); }
        else throw Object.assign(new Error("Remove an old network exclusion before adding another."), { status: 422 });
      }
      store.exclusions.push({ id: randomBytes(10).toString("hex"), hash, label: String(label).trim().slice(0, 80) || "My network", automatic, createdAt: new Date().toISOString() });
    }
    // Reclassify earlier views from this network; it must not remain 'external'.
    for (const record of Object.values(store.sites)) delete record.networks[hash];
    await write(store);
  }
  async function removeExclusion(id) { const store = await read(); store.exclusions = store.exclusions.filter(x => x.id !== id); await write(store); }
  const version = site => { const { updatedAt, createdAt, ...visible } = publicSite(site); return revisionOf(visible); };
  function receipt(site) {
    const payload = Buffer.from(JSON.stringify({ id: site.id, version: version(site), expires: Date.now() + 2 * 3600000 })).toString("base64url");
    return `${payload}.${hmac(`view-receipt:${payload}`)}`;
  }
  function receiptVersion(value, site) {
    try {
      const [payload, signature = ""] = String(value || "").split(".");
      if (!/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(hmac(`view-receipt:${payload}`)))) return null;
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
      return decoded.id === site.id && decoded.expires > Date.now() && /^[a-f0-9]{64}$/.test(decoded.version) ? decoded.version : null;
    } catch { return null; }
  }
  function prune(record) {
    const cutoff = Date.now() - days * 86400000;
    record.networks = Object.fromEntries(Object.entries(record.networks).filter(([, value]) => Date.parse(value.lastViewedAt) > cutoff));
    return record;
  }
  async function record(request, site, payload) {
    const deliveredVersion = receiptVersion(payload.receipt, site);
    if (!deliveredVersion) return;
    const address = resolveClientAddress(request);
    if (!address.reliable || !address.ip || isEditor(request) || payload.preview || payload.visible !== true) return;
    if (/bot|crawler|spider|preview|facebookexternalhit|slackbot|headless/i.test(String(request.headers["user-agent"] || ""))) return;
    const fetchSite = request.headers["sec-fetch-site"];
    if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return;
    const referer = String(request.headers.referer || "");
    if (referer) { try { const source = new URL(referer); if (source.searchParams.has("studio-preview") || source.searchParams.has("preview")) return; } catch { return; } }
    const store = await read();
    const hash = fingerprint(address.ip);
    if (store.exclusions.some(x => x.hash === hash)) return;
    const record = prune(store.sites[site.id] ?? { networks: {} });
    const previous = record.networks[hash];
    const currentVersion = deliveredVersion;
    if (previous && Date.now() - Date.parse(previous.lastViewedAt) < 30 * 60 * 1000 && previous.version === currentVersion) return;
    const now = new Date().toISOString();
    // An older tab can report after this network has already viewed the live update.
    // Keep that confirmation while retaining the delivered version for deduplication.
    const confirmedVersion = currentVersion === version(site) ? currentVersion : previous?.confirmedVersion ?? previous?.version ?? currentVersion;
    record.networks[hash] = { firstViewedAt: previous?.firstViewedAt ?? now, lastViewedAt: now, views: (previous?.views ?? 0) + 1, version: currentVersion, confirmedVersion };
    // Bound growth per record; normal correspondence is far below this ceiling.
    record.networks = Object.fromEntries(Object.entries(record.networks).sort(([, a], [, b]) => b.lastViewedAt.localeCompare(a.lastViewedAt)).slice(0, 1000));
    store.sites[site.id] = record;
    await write(store);
  }
  async function summary(sites) {
    const store = await read();
    return sites.map(site => {
      const networks = Object.values(prune(store.sites[site.id] ?? { networks: {} }).networks);
      return { siteId: site.id, title: site.title, reference: site.reference, archived: site.archived, viewed: networks.length > 0,
        uniqueNetworks: networks.length, views: networks.reduce((n, x) => n + x.views, 0),
        firstViewedAt: networks.map(x => x.firstViewedAt).sort()[0] ?? null,
        lastViewedAt: networks.map(x => x.lastViewedAt).sort().at(-1) ?? null,
        viewedLatestUpdate: networks.some(x => x.version === version(site) || x.confirmedVersion === version(site)) };
    });
  }
  async function settings(request) {
    const store = await read(); const address = resolveClientAddress(request);
    return { retentionDays: days, addressSource: address.source, addressReliable: address.reliable,
      currentNetworkExcluded: Boolean(address.ip && store.exclusions.some(x => x.hash === fingerprint(address.ip))),
      exclusions: store.exclusions.map(({ hash, ...entry }) => entry) };
  }
  async function cleanup() {
    const store = await read();
    for (const [id, entry] of Object.entries(store.sites)) { prune(entry); if (!Object.keys(entry.networks).length) delete store.sites[id]; }
    await write(store);
  }
  async function restore(imported, merge) {
    if (!imported) return;
    const next = validateEngagementBackup(imported);
    if (next.keyId !== keyId) throw Object.assign(new Error("QR engagement was exported with a different encryption key. Keep the original server encryption key to restore its exclusions and history."), { status: 422 });
    if (merge) {
      const current = await read();
      next.exclusions = [...new Map([...current.exclusions, ...next.exclusions].map(x => [x.hash, x])).values()].slice(-100);
      for (const [id, value] of Object.entries(current.sites)) {
        const target = next.sites[id] ?? { networks: {} };
        for (const [hash, entry] of Object.entries(value.networks)) if (!target.networks[hash] || target.networks[hash].lastViewedAt < entry.lastViewedAt) target.networks[hash] = entry;
        next.sites[id] = target;
      }
    }
    for (const record of Object.values(next.sites)) { prune(record); for (const entry of next.exclusions) delete record.networks[entry.hash]; }
    await write(next);
  }
  return { record, summary, settings, exclude, removeExclusion, rememberEditor, isEditor, cleanup, export: read, restore, receipt, keyId };
}

export function validateEngagementBackup(value) {
  const date = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (!value || !Array.isArray(value.exclusions) || value.exclusions.length > 100 || !value.sites || Array.isArray(value.sites) || typeof value.sites !== "object" || Object.keys(value.sites).length > 20000) throw new Error("Invalid QR engagement backup.");
  const exclusions = value.exclusions.map(entry => {
    if (!entry || typeof entry.id !== "string" || !hex(entry.hash) || typeof entry.label !== "string" || entry.label.length > 80 || !date(entry.createdAt)) throw new Error("Invalid network exclusion in backup.");
    return { id: entry.id, hash: entry.hash, label: entry.label, automatic: Boolean(entry.automatic), createdAt: entry.createdAt };
  });
  const sites = Object.create(null);
  for (const [id, record] of Object.entries(value.sites)) {
    if (["__proto__", "constructor", "prototype"].includes(id) || !record?.networks || Object.keys(record.networks).length > 1000) throw new Error("Invalid QR site in backup.");
    const networks = Object.create(null);
    for (const [hash, entry] of Object.entries(record.networks)) {
      if (!hex(hash) || !entry || !date(entry.firstViewedAt) || !date(entry.lastViewedAt) || !Number.isSafeInteger(entry.views) || entry.views < 1 || !hex(entry.version)) throw new Error("Invalid QR visit in backup.");
      if (entry.confirmedVersion !== undefined && !hex(entry.confirmedVersion)) throw new Error("Invalid QR version in backup.");
      networks[hash] = { firstViewedAt: entry.firstViewedAt, lastViewedAt: entry.lastViewedAt, views: entry.views, version: entry.version, confirmedVersion: entry.confirmedVersion ?? entry.version };
    }
    sites[id] = { networks };
  }
  if (!hex(value.keyId)) throw new Error("QR engagement backup key identity is missing.");
  return { keyId: value.keyId, exclusions, sites };
}
