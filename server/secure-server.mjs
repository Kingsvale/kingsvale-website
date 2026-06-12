import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { basename, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "dist");
const dataDir = resolve(rootDir, "data");
const cmsDir = resolve(dataDir, "cms");
const leadsDir = resolve(dataDir, "leads");
const uploadsDir = resolve(dataDir, "uploads");
const trackingDir = resolve(dataDir, "tracking-sites");
const analyticsDir = resolve(dataDir, "analytics");
const backupDir = resolve(dataDir, "backups");
const auditDir = dataDir;
const cmsStoreFile = join(cmsDir, "content.json");
const trackingStoreFile = join(trackingDir, "sites.json");
const analyticsStoreFile = join(analyticsDir, "visits.json");
const studioPath = "/251db172b850d056";
const port = Number(process.env.PORT ?? 4173);
const studioUser = process.env.STUDIO_USER ?? "kingsvale";
const studioPassword = process.env.STUDIO_PASSWORD;
const studioMfaSecret = process.env.STUDIO_TOTP_SECRET?.trim() ?? "";
const allowedStudioIps = new Set(parseCsv(process.env.STUDIO_ALLOWED_IPS).map(normalizeIp));
const sessionSecret = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
const cmsEncryptionKey = process.env.CMS_ENCRYPTION_KEY ?? "";
const leadWebhookSecret = process.env.LEAD_WEBHOOK_HMAC_SECRET ?? "";
const maxCmsRevisions = clampNumber(process.env.CMS_MAX_REVISIONS, 25, 5, 100);
const maxCmsBackups = clampNumber(process.env.CMS_MAX_BACKUPS, 30, 5, 120);
const secureCookies = process.env.SECURE_COOKIES
  ? process.env.SECURE_COOKIES === "true"
  : process.env.NODE_ENV === "production";
const requestBuckets = new Map();
const sessions = new Map();

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.unsplash.com; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

if (!studioPassword) {
  console.warn("STUDIO_PASSWORD is not set. The secure server will reject studio access.");
}

if (process.env.NODE_ENV === "production" && !cmsEncryptionKey) {
  console.warn("CMS_ENCRYPTION_KEY is not set. Local CMS files will be stored as plaintext JSON.");
}

await ensureDataDirs();

const server = createServer(async (request, response) => {
  try {
    applySecurityHeaders(response);
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const clientId = `${request.socket.remoteAddress ?? "unknown"}:${url.pathname}`;

    if (!allowRequest(clientId)) {
      await writeAudit("rate_limited", request, { path: url.pathname });
      sendJson(response, 429, { error: "Too many requests." });
      return;
    }

    if (isRestrictedStudioSurface(url.pathname) && !isAllowedStudioIp(request)) {
      await writeAudit("studio_ip_blocked", request, { path: url.pathname });
      sendJson(response, 403, { error: "Studio access is not available from this network." });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, url);
      return;
    }

    if (url.pathname.startsWith("/media/")) {
      await serveMedia(url.pathname, response);
      return;
    }

    if (isStudioResource(url.pathname)) {
      const session = getSession(request);
      if (!session) {
        if (url.pathname === studioPath && request.method === "GET") {
          sendStudioLogin(response);
          await writeAudit("studio_login_page", request, { path: url.pathname });
          return;
        }

        sendJson(response, 401, { error: "Authentication required." });
        await writeAudit("studio_auth_required", request, { path: url.pathname });
        return;
      }
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error." });
  }
});

server.listen(port, () => {
  console.log(`Secure Kingsvale server listening on http://127.0.0.1:${port}`);
});

async function ensureDataDirs() {
  await Promise.all([
    mkdir(cmsDir, { recursive: true }),
    mkdir(leadsDir, { recursive: true }),
    mkdir(uploadsDir, { recursive: true }),
    mkdir(trackingDir, { recursive: true }),
    mkdir(analyticsDir, { recursive: true }),
    mkdir(backupDir, { recursive: true })
  ]);
}

function applySecurityHeaders(response) {
  for (const [header, value] of Object.entries(securityHeaders)) {
    response.setHeader(header, value);
  }
}

function isStudioResource(pathname) {
  return pathname === studioPath || pathname.startsWith("/assets/studio-");
}

function isRestrictedStudioSurface(pathname) {
  return (
    isStudioResource(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cms/") ||
    pathname.startsWith("/api/uploads/")
  );
}

function isAllowedStudioIp(request) {
  if (allowedStudioIps.size === 0) {
    return true;
  }

  return allowedStudioIps.has(normalizeIp(request.socket.remoteAddress ?? ""));
}

function allowRequest(clientId) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 120;
  const bucket = requestBuckets.get(clientId) ?? { count: 0, resetAt: now + windowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  requestBuckets.set(clientId, bucket);
  return bucket.count <= limit;
}

async function handleApiRequest(request, response, url) {
  if (url.pathname === "/api/ops/health") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    sendJson(response, 200, {
      ok: Boolean(studioPassword),
      generatedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      storage: {
        driver: "local-files",
        cmsEncrypted: Boolean(cmsEncryptionKey),
        cmsBackups: maxCmsBackups,
        uploadVariants: "webp"
      },
      auth: {
        passwordConfigured: Boolean(studioPassword),
        mfaConfigured: Boolean(studioMfaSecret),
        ipAllowlistConfigured: allowedStudioIps.size > 0,
        cookieMode: secureCookies ? "secure" : "local"
      }
    });
    return;
  }

  if (url.pathname === "/api/auth/login") {
    await handleLogin(request, response);
    return;
  }

  if (url.pathname === "/api/auth/me") {
    const session = getSession(request);
    if (!session) {
      sendJson(response, 401, { error: "Not authenticated." });
      return;
    }

    sendJson(response, 200, {
      authenticated: true,
      user: { name: session.user, role: "editor" },
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString()
    });
    return;
  }

  if (url.pathname === "/api/auth/logout") {
    const session = requireSession(request, response);
    if (!session || !requireCsrf(request, response, session)) {
      return;
    }

    sessions.delete(session.id);
    response.setHeader("Set-Cookie", clearSessionCookie());
    await writeAudit("logout", request, { user: session.user });
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/content") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const store = await readCmsStore();
    sendJson(response, 200, {
      content: store.published,
      updatedAt: store.updatedAt ?? null
    });
    return;
  }

  if (url.pathname === "/api/contact" || url.pathname === "/api/newsletter") {
    await handlePublicLeadRequest(request, response, url.pathname);
    return;
  }

  if (url.pathname === "/api/analytics/visit") {
    await handleAnalyticsVisit(request, response);
    return;
  }

  if (url.pathname === "/api/analytics/summary") {
    await handleAnalyticsSummary(request, response);
    return;
  }

  if (url.pathname === "/api/tracking-sites") {
    await handleTrackingSitesCollection(request, response);
    return;
  }

  if (url.pathname.startsWith("/api/tracking-sites/")) {
    await handleTrackingSiteItem(request, response, url);
    return;
  }

  if (url.pathname === "/api/cms/draft") {
    const session = requireSession(request, response);
    if (!session) {
      return;
    }

    if (request.method === "GET") {
      const store = await readCmsStore();
      sendJson(response, 200, {
        draft: store.draft ?? store.published,
        published: store.published,
        updatedAt: store.updatedAt ?? null
      });
      return;
    }

    if (request.method === "PUT") {
      if (!requireCsrf(request, response, session)) {
        return;
      }

      const payload = await readJsonBody(request, 450_000);
      const validation = validateSiteContent(payload.content);
      if (!validation.valid) {
        sendJson(response, 400, { errors: validation.errors });
        return;
      }

      const store = await readCmsStore();
      store.draft = payload.content;
      store.updatedAt = new Date().toISOString();
      await writeCmsStore(store);
      await writeAudit("draft_saved", request, { user: session.user });
      sendJson(response, 200, { ok: true, updatedAt: store.updatedAt });
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (url.pathname === "/api/cms/publish") {
    const session = requireSession(request, response);
    if (!session || !requireCsrf(request, response, session)) {
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const payload = await readJsonBody(request, 450_000);
    const nextContent = payload.content;
    const validation = validateSiteContent(nextContent);
    if (!validation.valid) {
      sendJson(response, 400, { errors: validation.errors });
      return;
    }

    const store = await readCmsStore();
    if (store.published) {
      store.revisions.unshift({
        id: randomBytes(8).toString("hex"),
        createdAt: new Date().toISOString(),
        user: session.user,
        content: store.published
      });
      store.revisions = store.revisions.slice(0, maxCmsRevisions);
    }

    store.published = nextContent;
    store.draft = nextContent;
    store.updatedAt = new Date().toISOString();
    await writeCmsStore(store);
    await writeCmsBackup(store, "publish", session.user);
    await writeAudit("content_published", request, {
      user: session.user,
      revisionCount: store.revisions.length
    });
    sendJson(response, 200, { ok: true, updatedAt: store.updatedAt });
    return;
  }

  if (url.pathname === "/api/cms/revisions") {
    const session = requireSession(request, response);
    if (!session) {
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const store = await readCmsStore();
    sendJson(response, 200, {
      revisions: store.revisions.map(({ id, createdAt, user, content }) => ({
        id,
        createdAt,
        user,
        title: content?.hero?.title ?? "Untitled revision"
      }))
    });
    return;
  }

  if (url.pathname.startsWith("/api/cms/revisions/") && url.pathname.endsWith("/restore")) {
    const session = requireSession(request, response);
    if (!session || !requireCsrf(request, response, session)) {
      return;
    }

    const revisionId = url.pathname.split("/")[4];
    const store = await readCmsStore();
    const revision = store.revisions.find((item) => item.id === revisionId);
    if (!revision) {
      sendJson(response, 404, { error: "Revision not found." });
      return;
    }

    if (store.published) {
      store.revisions.unshift({
        id: randomBytes(8).toString("hex"),
        createdAt: new Date().toISOString(),
        user: session.user,
        content: store.published
      });
    }

    store.published = revision.content;
    store.draft = revision.content;
    store.updatedAt = new Date().toISOString();
    store.revisions = store.revisions.slice(0, maxCmsRevisions);
    await writeCmsStore(store);
    await writeCmsBackup(store, "restore", session.user);
    await writeAudit("revision_restored", request, { user: session.user, revisionId });
    sendJson(response, 200, { ok: true, content: revision.content });
    return;
  }

  if (url.pathname === "/api/uploads/images") {
    const session = requireSession(request, response);
    if (!session || !requireCsrf(request, response, session)) {
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await handleImageUpload(request, response, session);
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

async function handleLogin(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const payload = await readFlexibleBody(request, 20_000);
  const username = String(payload.username ?? "");
  const password = String(payload.password ?? "");
  const mfaCode = String(payload.mfaCode ?? "");

  if (
    !studioPassword ||
    username !== studioUser ||
    !timingSafeEqualText(password, studioPassword) ||
    (studioMfaSecret && !verifyTotpCode(mfaCode, studioMfaSecret))
  ) {
    await writeAudit("login_failed", request, { username });
    sendJson(response, 401, { error: "Invalid credentials." });
    return;
  }

  const session = createSession(username);
  sessions.set(session.id, session);
  response.setHeader("Set-Cookie", buildSessionCookie(session.id));
  await writeAudit("login_success", request, { user: username });

  if (request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 200, {
      ok: true,
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString()
    });
    return;
  }

  response.writeHead(303, { Location: studioPath });
  response.end();
}

function createSession(user) {
  return {
    id: randomBytes(24).toString("hex"),
    csrfToken: randomBytes(24).toString("hex"),
    user,
    expiresAt: Date.now() + 1000 * 60 * 60 * 8
  };
}

function getSession(request) {
  const cookies = parseCookies(request.headers.cookie ?? "");
  const rawCookie = cookies.kv_session;
  if (!rawCookie) {
    return null;
  }

  const [id, signature] = rawCookie.split(".");
  if (!id || !signature || !verifySignature(id, signature)) {
    return null;
  }

  const session = sessions.get(id);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }

  return session;
}

function requireSession(request, response) {
  const session = getSession(request);
  if (!session) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }
  return session;
}

function requireCsrf(request, response, session) {
  const token = request.headers["x-csrf-token"];
  if (token !== session.csrfToken) {
    sendJson(response, 403, { error: "Invalid CSRF token." });
    return false;
  }
  return true;
}

function buildSessionCookie(sessionId) {
  const signed = `${sessionId}.${sign(sessionId)}`;
  const secure = secureCookies ? "; Secure" : "";
  return `kv_session=${signed}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}

function clearSessionCookie() {
  const secure = secureCookies ? "; Secure" : "";
  return `kv_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function sign(value) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function verifySignature(value, signature) {
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, pair) => {
    const [key, ...rest] = pair.trim().split("=");
    if (key) {
      cookies[key] = decodeURIComponent(rest.join("="));
    }
    return cookies;
  }, {});
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyTotpCode(code, secret) {
  const normalizedCode = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const key = decodeBase32(secret);
  if (key.length === 0) {
    return false;
  }

  const counter = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((windowOffset) =>
    timingSafeEqualText(normalizedCode, generateTotp(key, counter + windowOffset))
  );
}

function generateTotp(key, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bytes = [];
  let bits = 0;
  let bitCount = 0;

  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index === -1) {
      return Buffer.alloc(0);
    }

    bits = (bits << 5) | index;
    bitCount += 5;
    if (bitCount >= 8) {
      bytes.push((bits >> (bitCount - 8)) & 0xff);
      bitCount -= 8;
    }
  }

  return Buffer.from(bytes);
}

async function handlePublicLeadRequest(request, response, path) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const payload = await readJsonBody(request, 20_000);
  const validation = path === "/api/newsletter"
    ? validateNewsletter(payload)
    : validateContact(payload);

  if (!validation.valid) {
    await writeAudit("invalid_form", request, { path, errors: validation.errors });
    sendJson(response, 400, { errors: validation.errors });
    return;
  }

  const kind = path === "/api/newsletter" ? "newsletter" : "contact";
  const record = {
    id: randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
    kind,
    payload: sanitizeLeadPayload(payload),
    ip: request.socket.remoteAddress,
    userAgent: request.headers["user-agent"]
  };
  await appendFile(join(leadsDir, `${kind}.jsonl`), `${JSON.stringify(record)}\n`);
  await forwardLead(kind, record);
  await writeAudit("lead_received", request, { kind, id: record.id });
  sendJson(response, 202, { ok: true, id: record.id });
}

async function handleTrackingSitesCollection(request, response) {
  const session = requireSession(request, response);
  if (!session) {
    return;
  }

  if (request.method === "GET") {
    const store = await readTrackingStore();
    sendJson(response, 200, {
      sites: store.sites,
      updatedAt: store.updatedAt ?? null
    });
    return;
  }

  if (request.method === "PUT") {
    if (!requireCsrf(request, response, session)) {
      return;
    }

    const payload = await readJsonBody(request, 90_000);
    const site = payload.site;
    const validation = validateTrackingSite(site);
    if (!validation.valid) {
      sendJson(response, 400, { errors: validation.errors });
      return;
    }

    const store = await readTrackingStore();
    const existingTokenOwner = store.sites.find(
      (item) => item.token === site.token && item.id !== site.id
    );
    if (existingTokenOwner) {
      sendJson(response, 409, { error: "Tracking link token already exists." });
      return;
    }

    const now = new Date().toISOString();
    const savedSite = {
      ...site,
      createdAt: site.createdAt || now,
      updatedAt: now,
      archived: Boolean(site.archived)
    };
    store.sites = store.sites.some((item) => item.id === savedSite.id)
      ? store.sites.map((item) => (item.id === savedSite.id ? savedSite : item))
      : [savedSite, ...store.sites];
    store.updatedAt = now;
    await writeTrackingStore(store);
    await writeAudit("tracking_site_saved", request, { user: session.user, siteId: savedSite.id });
    sendJson(response, 200, { ok: true, site: savedSite });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function handleTrackingSiteItem(request, response, url) {
  const [, , , idOrToken, action] = url.pathname.split("/");
  const decodedIdOrToken = decodeURIComponent(idOrToken ?? "");

  if (!action && request.method === "GET") {
    const store = await readTrackingStore();
    const site = store.sites.find((item) => item.token === decodedIdOrToken && !item.archived);
    sendJson(response, site ? 200 : 404, { site: site ?? null });
    return;
  }

  const session = requireSession(request, response);
  if (!session || !requireCsrf(request, response, session)) {
    return;
  }

  if (action === "archive" && request.method === "POST") {
    const store = await readTrackingStore();
    const target = store.sites.find((site) => site.id === decodedIdOrToken);
    if (!target) {
      sendJson(response, 404, { error: "Tracking site not found." });
      return;
    }

    const archivedSite = {
      ...target,
      archived: true,
      updatedAt: new Date().toISOString()
    };
    store.sites = store.sites.map((site) => (site.id === archivedSite.id ? archivedSite : site));
    store.updatedAt = archivedSite.updatedAt;
    await writeTrackingStore(store);
    await writeAudit("tracking_site_archived", request, { user: session.user, siteId: archivedSite.id });
    sendJson(response, 200, { ok: true, site: archivedSite });
    return;
  }

  if (action === "sync" && request.method === "POST") {
    const store = await readTrackingStore();
    const target = store.sites.find((site) => site.id === decodedIdOrToken);
    if (!target) {
      sendJson(response, 404, { error: "Tracking site not found." });
      return;
    }

    const checkedAt = new Date().toISOString();
    const syncedSite = {
      ...target,
      updatedAt: checkedAt,
      council: {
        ...target.council,
        lastCheckedAt: checkedAt,
        lastSyncStatus: "Connector shell only. Configure a council API to automate updates."
      }
    };
    store.sites = store.sites.map((site) => (site.id === syncedSite.id ? syncedSite : site));
    store.updatedAt = checkedAt;
    await writeTrackingStore(store);
    await writeAudit("tracking_site_sync_checked", request, {
      user: session.user,
      siteId: syncedSite.id,
      council: syncedSite.council.councilName
    });
    sendJson(response, 200, { ok: true, site: syncedSite });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function handleAnalyticsVisit(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const payload = await readJsonBody(request, 8_000);
  const visit = normalizeAnalyticsVisit(payload.visit);
  if (!visit) {
    sendJson(response, 400, { error: "Invalid analytics visit." });
    return;
  }

  const store = await readAnalyticsStore();
  store.visits = [visit, ...store.visits].slice(0, 5_000);
  store.updatedAt = new Date().toISOString();
  await writeAnalyticsStore(store);
  sendJson(response, 202, { ok: true });
}

async function handleAnalyticsSummary(request, response) {
  const session = requireSession(request, response);
  if (!session) {
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const store = await readAnalyticsStore();
  sendJson(response, 200, {
    summary: buildAnalyticsSummary(store.visits, store.updatedAt)
  });
}

async function forwardLead(kind, record) {
  const webhook = kind === "newsletter"
    ? process.env.NEWSLETTER_WEBHOOK_URL
    : process.env.CONTACT_WEBHOOK_URL;

  if (!webhook) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const body = JSON.stringify(record);
    const headers = { "Content-Type": "application/json" };
    if (leadWebhookSecret) {
      headers["x-kingsvale-signature"] = `sha256=${createHmac("sha256", leadWebhookSecret)
        .update(body)
        .digest("hex")}`;
    }

    await fetch(webhook, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch (error) {
    await appendFile(
      join(leadsDir, "webhook-errors.log"),
      `${new Date().toISOString()} ${kind} ${error instanceof Error ? error.message : "unknown"}\n`
    );
  }
}

function sanitizeLeadPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim().slice(0, 1200) : value
    ])
  );
}

async function handleImageUpload(request, response, session) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    sendJson(response, 415, { error: "Upload must be multipart/form-data." });
    return;
  }

  const body = await readRequestBody(request, 6_000_000);
  const upload = parseMultipartFile(body, contentType);
  if (!upload) {
    sendJson(response, 400, { error: "Image file is required." });
    return;
  }

  if (!isAllowedImageType(upload.contentType)) {
    sendJson(response, 415, { error: "Only JPEG, PNG, WebP and AVIF images are supported." });
    return;
  }

  let metadata;
  try {
    metadata = await sharp(upload.data).metadata();
  } catch {
    sendJson(response, 400, { error: "Image bytes could not be decoded." });
    return;
  }

  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 32_000_000) {
    sendJson(response, 400, { error: "Image dimensions are not supported." });
    return;
  }

  const slug = toSlug(upload.filename.replace(/\.[^.]+$/, "")) || "image";
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const widths = [480, 960, 1440, 1920].filter((width) => width <= Math.max(metadata.width, 480));
  const variants = [];

  for (const width of widths) {
    const filename = `${slug}-${id}-${width}.webp`;
    await sharp(upload.data)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toFile(join(uploadsDir, filename));
    variants.push({ width, src: `/media/${filename}`, type: "image/webp" });
  }

  const largest = variants.at(-1);
  await writeAudit("image_uploaded", request, {
    user: session.user,
    filename: upload.filename,
    width: metadata.width,
    height: metadata.height,
    variants: variants.length
  });

  sendJson(response, 201, {
    image: {
      src: largest.src,
      alt: upload.filename.replace(/\.[^.]+$/, ""),
      focalPoint: "50% 50%"
    },
    variants
  });
}

function parseMultipartFile(body, contentType) {
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
  if (!boundary) {
    return null;
  }

  const boundaryBytes = Buffer.from(`--${boundary}`);
  let start = body.indexOf(boundaryBytes);
  while (start !== -1) {
    const next = body.indexOf(boundaryBytes, start + boundaryBytes.length);
    if (next === -1) {
      break;
    }

    const part = body.subarray(start + boundaryBytes.length + 2, next - 2);
    const separator = part.indexOf(Buffer.from("\r\n\r\n"));
    if (separator !== -1) {
      const rawHeaders = part.subarray(0, separator).toString("utf8");
      const data = part.subarray(separator + 4);
      const filename = rawHeaders.match(/filename="([^"]+)"/)?.[1];
      const fieldName = rawHeaders.match(/name="([^"]+)"/)?.[1];
      const partContentType = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i)?.[1];

      if (filename && (fieldName === "image" || fieldName === "file")) {
        return {
          filename: basename(filename),
          contentType: partContentType ?? "application/octet-stream",
          data
        };
      }
    }

    start = next;
  }

  return null;
}

function isAllowedImageType(contentType) {
  return ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(contentType);
}

async function readCmsStore() {
  try {
    const raw = await readFile(cmsStoreFile, "utf8");
    const parsed = decodeCmsStore(raw);
    return {
      published: parsed.published ?? null,
      draft: parsed.draft ?? null,
      revisions: Array.isArray(parsed.revisions) ? parsed.revisions : [],
      updatedAt: parsed.updatedAt ?? null
    };
  } catch {
    return { published: null, draft: null, revisions: [], updatedAt: null };
  }
}

async function writeCmsStore(store) {
  await mkdir(cmsDir, { recursive: true });
  await writeFile(cmsStoreFile, encodeCmsStore(store));
}

async function readTrackingStore() {
  try {
    const raw = await readFile(trackingStoreFile, "utf8");
    const parsed = decodeCmsStore(raw);
    const sites = Array.isArray(parsed.sites)
      ? parsed.sites.map(normalizeTrackingSite).filter((site) => validateTrackingSite(site).valid)
      : [];
    return {
      sites,
      updatedAt: parsed.updatedAt ?? null
    };
  } catch {
    return { sites: [], updatedAt: null };
  }
}

async function writeTrackingStore(store) {
  await mkdir(trackingDir, { recursive: true });
  await writeFile(trackingStoreFile, encodeCmsStore(store));
}

async function readAnalyticsStore() {
  try {
    const raw = await readFile(analyticsStoreFile, "utf8");
    const parsed = decodeCmsStore(raw);
    return {
      visits: Array.isArray(parsed.visits) ? parsed.visits.filter(isAnalyticsVisit) : [],
      updatedAt: parsed.updatedAt ?? null
    };
  } catch {
    return { visits: [], updatedAt: null };
  }
}

async function writeAnalyticsStore(store) {
  await mkdir(analyticsDir, { recursive: true });
  await writeFile(analyticsStoreFile, encodeCmsStore(store));
}

async function writeCmsBackup(store, event, user) {
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${stamp}-${toSlug(event)}-${toSlug(user || "system")}.json`;
  await writeFile(join(backupDir, filename), encodeCmsStore(store));
  await pruneCmsBackups();
}

async function pruneCmsBackups() {
  const entries = await readdir(backupDir);
  const backupFiles = entries.filter((entry) => entry.endsWith(".json")).sort().reverse();
  await Promise.all(
    backupFiles.slice(maxCmsBackups).map((entry) => unlink(join(backupDir, entry)).catch(() => undefined))
  );
}

function encodeCmsStore(store) {
  const body = `${JSON.stringify(store, null, 2)}\n`;
  const key = getCmsEncryptionKey();
  if (!key) {
    return body;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${JSON.stringify(
    {
      encrypted: true,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64url"),
      tag: tag.toString("base64url"),
      payload: ciphertext.toString("base64url")
    },
    null,
    2
  )}\n`;
}

function decodeCmsStore(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed?.encrypted) {
    return parsed;
  }

  const key = getCmsEncryptionKey();
  if (!key) {
    throw new Error("CMS_ENCRYPTION_KEY is required to read encrypted CMS storage.");
  }

  const decipher = createDecipheriv(
    parsed.algorithm,
    key,
    Buffer.from(parsed.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.payload, "base64url")),
    decipher.final()
  ]).toString("utf8");
  return JSON.parse(plaintext);
}

function getCmsEncryptionKey() {
  if (!cmsEncryptionKey) {
    return null;
  }

  return createHash("sha256").update(cmsEncryptionKey).digest();
}

async function readFlexibleBody(request, limit) {
  const raw = await readRequestBody(request, limit);
  const contentType = request.headers["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw.toString("utf8") || "{}");
    } catch {
      return {};
    }
  }

  const params = new URLSearchParams(raw.toString("utf8"));
  return Object.fromEntries(params.entries());
}

async function readJsonBody(request, limit) {
  const raw = await readRequestBody(request, limit);
  try {
    return JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    return {};
  }
}

async function readRequestBody(request, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > limit) {
      throw new Error("Request body too large.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function validateNewsletter(payload) {
  const errors = [];
  if (!isEmail(payload.email)) {
    errors.push("A valid email address is required.");
  }
  return { valid: errors.length === 0, errors };
}

function validateContact(payload) {
  const errors = [];
  if (!isShortText(payload.name, 2, 80)) {
    errors.push("Name must be between 2 and 80 characters.");
  }
  if (!isEmail(payload.email)) {
    errors.push("A valid email address is required.");
  }
  if (!isShortText(payload.type, 4, 80)) {
    errors.push("Choose a valid enquiry type.");
  }
  if (!isShortText(payload.message, 10, 1200)) {
    errors.push("Message must be between 10 and 1200 characters.");
  }
  return { valid: errors.length === 0, errors };
}

function validateSiteContent(content) {
  const errors = [];
  if (!content || typeof content !== "object") {
    return { valid: false, errors: [{ path: "content", message: "Content is required." }] };
  }

  validateText(errors, "brandName", content.brandName, "Brand name", 24);
  validateText(errors, "brandSuffix", content.brandSuffix, "Brand suffix", 16);
  validateLinks(errors, "navLinks", content.navLinks, 3, 8);

  validateText(errors, "hero.eyebrow", content.hero?.eyebrow, "Hero eyebrow", 32);
  validateText(errors, "hero.title", content.hero?.title, "Hero title", 86);
  validateText(errors, "hero.subtitle", content.hero?.subtitle, "Hero subtitle", 130);
  validateText(errors, "hero.ctaLabel", content.hero?.ctaLabel, "Hero CTA label", 34);
  validateUrl(errors, "hero.ctaHref", content.hero?.ctaHref, "Hero CTA link");
  validateImage(errors, "hero.image", content.hero?.image);

  if (!Array.isArray(content.features) || content.features.length !== 4) {
    errors.push({ path: "features", message: "Use exactly four feature-strip items." });
  } else {
    content.features.forEach((feature, index) => {
      validateText(errors, `features.${index}.title`, feature.title, "Feature title", 42);
      validateText(errors, `features.${index}.description`, feature.description, "Feature description", 120);
      if (!["award", "home", "leaf", "users", "map", "sparkle"].includes(feature.icon)) {
        errors.push({ path: `features.${index}.icon`, message: "Choose an approved icon." });
      }
    });
  }

  validateEditorial(errors, "about", content.about);

  validateText(errors, "developmentsIntro.eyebrow", content.developmentsIntro?.eyebrow, "Developments eyebrow", 32);
  validateText(errors, "developmentsIntro.title", content.developmentsIntro?.title, "Developments title", 78);
  validateText(errors, "developmentsIntro.viewAllLabel", content.developmentsIntro?.viewAllLabel, "Developments link label", 34);
  validateUrl(errors, "developmentsIntro.viewAllHref", content.developmentsIntro?.viewAllHref, "Developments link");

  validateEditorial(errors, "landWanted", content.landWanted);

  if (!Array.isArray(content.developments) || content.developments.length < 1 || content.developments.length > 6) {
    errors.push({ path: "developments", message: "Use between one and six developments." });
  } else {
    content.developments.forEach((development, index) => {
      validateText(errors, `developments.${index}.title`, development.title, "Development title", 42);
      validateText(errors, `developments.${index}.location`, development.location, "Development location", 44);
      validateText(errors, `developments.${index}.description`, development.description, "Development description", 130);
      validateText(errors, `developments.${index}.ctaLabel`, development.ctaLabel, "Development CTA label", 34);
      validateUrl(errors, `developments.${index}.ctaHref`, development.ctaHref, "Development CTA link");
      validateImage(errors, `developments.${index}.image`, development.image);
    });
  }

  validateLinks(errors, "footer.exploreLinks", content.footer?.exploreLinks, 1, 8);
  validateLinks(errors, "footer.socialLinks", content.footer?.socialLinks, 0, 4);
  validateLinks(errors, "footer.legalLinks", content.footer?.legalLinks, 1, 4);
  validateText(errors, "footer.description", content.footer?.description, "Footer description", 150);
  validateText(errors, "footer.email", content.footer?.email, "Footer email", 120);
  validateText(errors, "footer.phone", content.footer?.phone, "Footer phone", 120);
  validateText(errors, "footer.address", content.footer?.address, "Footer address", 120);
  validateText(errors, "footer.newsletterTitle", content.footer?.newsletterTitle, "Newsletter title", 32);
  validateText(errors, "footer.newsletterCopy", content.footer?.newsletterCopy, "Newsletter copy", 140);
  validateText(errors, "footer.newsletterPlaceholder", content.footer?.newsletterPlaceholder, "Newsletter placeholder", 42);

  return { valid: errors.length === 0, errors };
}

function validateTrackingSite(site) {
  const errors = [];
  if (!site || typeof site !== "object") {
    return { valid: false, errors: [{ path: "site", message: "Tracking site is required." }] };
  }

  if (typeof site.id !== "string" || !site.id.trim() || site.id.length > 80) {
    errors.push({ path: "id", message: "Tracking site id is required." });
  }

  if (typeof site.token !== "string" || !/^[a-zA-Z0-9_-]{16,40}$/.test(site.token)) {
    errors.push({ path: "token", message: "Tracking token must be URL-safe and unguessable." });
  }

  validateText(errors, "title", site.title, "Site title", 72);
  validateText(errors, "siteAddress", site.siteAddress, "Site address", 160);
  validateText(errors, "statusNote", site.statusNote, "Status note", 320);
  validateOptionalText(errors, "customerName", site.customerName, "Customer name", 80);
  validateOptionalText(errors, "reference", site.reference, "Reference", 64);
  validateOptionalText(errors, "summary", site.summary, "Summary", 240);

  if (!["planning", "submitted", "in-review", "approved", "construction", "complete", "on-hold"].includes(site.currentStatus)) {
    errors.push({ path: "currentStatus", message: "Choose an approved status." });
  }

  if (!Array.isArray(site.milestones) || site.milestones.length < 1 || site.milestones.length > 8) {
    errors.push({ path: "milestones", message: "Use between one and eight milestones." });
  } else {
    site.milestones.forEach((milestone, index) => {
      validateText(errors, `milestones.${index}.label`, milestone.label, "Milestone label", 72);
      validateOptionalText(errors, `milestones.${index}.note`, milestone.note ?? "", "Milestone note", 180);
      if (!["pending", "active", "complete", "blocked"].includes(milestone.state)) {
        errors.push({ path: `milestones.${index}.state`, message: "Choose an approved milestone state." });
      }
    });
  }

  validateQrStyle(errors, site.qrStyle);

  if (!Array.isArray(site.resources) || site.resources.length > 8) {
    errors.push({ path: "resources", message: "Use up to eight customer resources." });
  } else {
    site.resources.forEach((resource, index) => {
      validateText(errors, `resources.${index}.title`, resource.title, "Resource title", 80);
      validateOptionalText(errors, `resources.${index}.note`, resource.note ?? "", "Resource note", 180);
      if (!["image", "document", "link"].includes(resource.type)) {
        errors.push({ path: `resources.${index}.type`, message: "Choose an approved resource type." });
      }
      if (typeof resource.url !== "string" || resource.url.length > 900 || !isSafeResourceUrl(resource.url)) {
        errors.push({ path: `resources.${index}.url`, message: "Resource URL must be safe." });
      }
    });
  }

  const council = site.council;
  if (!council || typeof council !== "object") {
    errors.push({ path: "council", message: "Council settings are required." });
  } else {
    if (!["none", "configured"].includes(council.mode)) {
      errors.push({ path: "council.mode", message: "Choose a council sync mode." });
    }

    validateOptionalText(errors, "council.councilName", council.councilName, "Council name", 90);
    validateOptionalText(
      errors,
      "council.applicationReference",
      council.applicationReference,
      "Application reference",
      80
    );

    if (council.mode === "configured") {
      validateText(errors, "council.councilName", council.councilName, "Council name", 90);
      validateText(
        errors,
        "council.applicationReference",
        council.applicationReference,
        "Application reference",
        80
      );
    }

    if (council.apiBaseUrl && !isSafeHttpUrl(council.apiBaseUrl)) {
      errors.push({ path: "council.apiBaseUrl", message: "Council API URL must be an HTTP URL." });
    }
  }

  return { valid: errors.length === 0, errors };
}

function normalizeTrackingSite(site) {
  const qrStyle = site.qrStyle ?? {};
  const council = site.council ?? {};
  return {
    ...site,
    resources: Array.isArray(site.resources) ? site.resources : [],
    qrStyle: {
      foreground: qrStyle.foreground ?? "#22211d",
      background: qrStyle.background ?? "#fbf8f2",
      accent: qrStyle.accent ?? "#ad9576",
      dotRoundness: numberOrFallback(qrStyle.dotRoundness, presetRoundness(qrStyle.dotStyle)),
      finderRoundness: numberOrFallback(qrStyle.finderRoundness, presetRoundness(qrStyle.finderStyle)),
      frameRoundness: numberOrFallback(qrStyle.frameRoundness, qrStyle.frameStyle === "square" ? 0 : 42),
      frameCut: numberOrFallback(qrStyle.frameCut, qrStyle.frameStyle === "cut-corner" ? 36 : 0),
      frameLabel: qrStyle.frameLabel ?? "Scan for project updates",
      includeLogo: qrStyle.includeLogo ?? true
    },
    council: {
      mode: council.mode ?? "none",
      councilName: council.councilName ?? "",
      applicationReference: council.applicationReference ?? "",
      apiBaseUrl: council.apiBaseUrl ?? "",
      lastCheckedAt: council.lastCheckedAt ?? null,
      lastSyncStatus: council.lastSyncStatus ?? "Not configured"
    }
  };
}

function validateQrStyle(errors, qrStyle) {
  if (!qrStyle || typeof qrStyle !== "object") {
    errors.push({ path: "qrStyle", message: "QR style settings are required." });
    return;
  }

  if (!isHexColor(qrStyle.foreground)) {
    errors.push({ path: "qrStyle.foreground", message: "QR foreground must be a hex colour." });
  }
  if (!isHexColor(qrStyle.background)) {
    errors.push({ path: "qrStyle.background", message: "QR background must be a hex colour." });
  }
  if (!isHexColor(qrStyle.accent)) {
    errors.push({ path: "qrStyle.accent", message: "QR accent must be a hex colour." });
  }
  validatePercentage(errors, "qrStyle.dotRoundness", qrStyle.dotRoundness, "Dot roundness");
  validatePercentage(errors, "qrStyle.finderRoundness", qrStyle.finderRoundness, "Finder roundness");
  validatePercentage(errors, "qrStyle.frameRoundness", qrStyle.frameRoundness, "Frame roundness");
  validatePercentage(errors, "qrStyle.frameCut", qrStyle.frameCut, "Frame cut");
  validateText(errors, "qrStyle.frameLabel", qrStyle.frameLabel, "QR label", 46);
}

function normalizeAnalyticsVisit(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const path = typeof input.path === "string" ? input.path.trim().slice(0, 160) : "";
  const routeType = input.routeType === "tracking" ? "tracking" : "website";
  if (!path || path === "/admin" || path.startsWith(studioPath) || path.startsWith("/api/")) {
    return null;
  }

  return {
    id: `visit-${Date.now()}-${randomBytes(4).toString("hex")}`,
    path,
    title: typeof input.title === "string" ? input.title.trim().slice(0, 120) || "Untitled page" : "Untitled page",
    routeType,
    visitedAt: new Date().toISOString()
  };
}

function buildAnalyticsSummary(visits, updatedAt = null) {
  const cleanVisits = visits.filter(isAnalyticsVisit).sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  const today = new Date().toISOString().slice(0, 10);
  const routeMap = new Map();

  for (const visit of cleanVisits) {
    const key = `${visit.routeType}:${visit.path}`;
    const current = routeMap.get(key);
    if (current) {
      current.visits += 1;
    } else {
      routeMap.set(key, {
        path: visit.path,
        title: visit.title,
        routeType: visit.routeType,
        visits: 1
      });
    }
  }

  return {
    totalVisits: cleanVisits.length,
    websiteVisits: cleanVisits.filter((visit) => visit.routeType === "website").length,
    trackingVisits: cleanVisits.filter((visit) => visit.routeType === "tracking").length,
    todayVisits: cleanVisits.filter((visit) => visit.visitedAt.startsWith(today)).length,
    uniqueRoutes: routeMap.size,
    topRoutes: [...routeMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 6),
    dailyVisits: buildDailyVisits(cleanVisits),
    updatedAt
  };
}

function buildDailyVisits(visits) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      visits: visits.filter((visit) => visit.visitedAt.startsWith(key)).length
    };
  });
}

function isAnalyticsVisit(value) {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.path === "string" &&
    typeof value.title === "string" &&
    (value.routeType === "website" || value.routeType === "tracking") &&
    typeof value.visitedAt === "string"
  );
}

function validatePercentage(errors, path, value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push({ path, message: `${label} must be between 0 and 100.` });
  }
}

function numberOrFallback(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function presetRoundness(value) {
  if (value === "square") {
    return 0;
  }
  if (value === "circle") {
    return 100;
  }
  return 48;
}

function validateEditorial(errors, path, content) {
  validateText(errors, `${path}.eyebrow`, content?.eyebrow, "Eyebrow", 32);
  validateText(errors, `${path}.title`, content?.title, "Section title", 78);
  validateText(errors, `${path}.body`, content?.body, "Body copy", 340);
  validateText(errors, `${path}.ctaLabel`, content?.ctaLabel, "CTA label", 34);
  validateUrl(errors, `${path}.ctaHref`, content?.ctaHref, "CTA link");
  validateImage(errors, `${path}.image`, content?.image);
}

function validateLinks(errors, path, links, min, max) {
  if (!Array.isArray(links) || links.length < min || links.length > max) {
    errors.push({ path, message: `Use between ${min} and ${max} links.` });
    return;
  }
  links.forEach((link, index) => {
    validateText(errors, `${path}.${index}.label`, link.label, "Link label", 32);
    validateUrl(errors, `${path}.${index}.href`, link.href, "Link URL");
  });
}

function validateText(errors, path, value, label, max) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ path, message: `${label} is required.` });
    return;
  }
  if (value.trim().length > max) {
    errors.push({ path, message: `${label} must be ${max} characters or fewer.` });
  }
}

function validateOptionalText(errors, path, value, label, max) {
  if (typeof value === "string" && value.trim().length > max) {
    errors.push({ path, message: `${label} must be ${max} characters or fewer.` });
  }
}

function validateUrl(errors, path, value, label) {
  if (typeof value !== "string" || !isSafeUrl(value)) {
    errors.push({ path, message: `${label} must be a safe URL.` });
  }
}

function validateImage(errors, path, image) {
  if (!image || typeof image !== "object") {
    errors.push({ path, message: "Image is required." });
    return;
  }
  validateText(errors, `${path}.alt`, image.alt, "Image alt text", 150);
  if (typeof image.src !== "string" || !isSafeImageSource(image.src)) {
    errors.push({ path: `${path}.src`, message: "Image source must be an approved URL or uploaded media path." });
  }
}

function isSafeUrl(value) {
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSafeResourceUrl(value) {
  if (value.startsWith("/media/") || value.startsWith("/assets/") || value.startsWith("/")) {
    return true;
  }

  return isSafeHttpUrl(value);
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isSafeImageSource(value) {
  if (value.startsWith("/media/") || value.startsWith("/assets/")) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isShortText(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function toSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function parseCsv(value = "") {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeIp(value) {
  return value.replace(/^::ffff:/, "").replace(/^\[|\]$/g, "");
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

async function serveMedia(pathname, response) {
  const safePath = normalize(decodeURIComponent(pathname.replace(/^\/media\//, ""))).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(uploadsDir, safePath);
  if (!candidate.startsWith(uploadsDir)) {
    sendJson(response, 404, { error: "Media not found." });
    return;
  }

  try {
    await stat(candidate);
  } catch {
    sendJson(response, 404, { error: "Media not found." });
    return;
  }

  response.setHeader("Content-Type", mimeTypes[extname(candidate)] ?? "application/octet-stream");
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  createReadStream(candidate).pipe(response);
}

async function serveStatic(pathname, response) {
  const filePath = resolveStaticPath(pathname);
  let fileInfo;

  try {
    fileInfo = await stat(filePath);
  } catch {
    return serveStatic("/app.html", response);
  }

  if (fileInfo.isDirectory()) {
    const routeIndex = join(filePath, "index.html");
    try {
      const routeIndexInfo = await stat(routeIndex);
      if (!routeIndexInfo.isDirectory()) {
        return sendStaticFile(routeIndex, response);
      }
    } catch {
      return serveStatic("/app.html", response);
    }
  }

  return sendStaticFile(filePath, response);
}

function sendStaticFile(filePath, response) {
  response.setHeader("Content-Type", mimeTypes[extname(filePath)] ?? "application/octet-stream");
  if (basename(filePath) === "app.html") {
    response.setHeader("Cache-Control", "no-store");
  } else if (filePath.includes(`${normalize("/assets/")}`)) {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (extname(filePath) === ".html") {
    response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  } else {
    response.setHeader("Cache-Control", "public, max-age=3600");
  }

  createReadStream(filePath).pipe(response);
}

function resolveStaticPath(pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(distDir, safePath.slice(1));
  if (!candidate.startsWith(distDir)) {
    return join(distDir, "index.html");
  }
  return candidate;
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function sendStudioLogin(response) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kingsvale Studio Access</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#22211d;color:#f4efe6;font-family:Arial,sans-serif}
    main{width:min(440px,calc(100vw - 32px));padding:40px;border:1px solid rgba(198,169,125,.35);background:#2a2925}
    h1{font-family:Georgia,serif;font-size:34px;font-weight:400;margin:0 0 12px}
    p{color:#d9d0c2;line-height:1.55}
    label{display:grid;gap:8px;margin:18px 0}
    input{padding:14px;background:#f4efe6;border:0;color:#22211d}
    button{width:100%;padding:15px;border:0;background:#d8c5a8;color:#22211d;text-transform:uppercase;font-weight:700}
  </style>
</head>
<body>
  <main>
    <p>Private studio</p>
    <h1>Authorised editing only.</h1>
    <p>Sign in to open the Kingsvale content studio. Sessions use an HttpOnly cookie and server-side asset protection.</p>
    <form method="post" action="/api/auth/login">
      <label>Username<input name="username" autocomplete="username" required /></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
      ${studioMfaSecret ? '<label>Authenticator code<input name="mfaCode" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required /></label>' : ""}
      <button type="submit">Enter studio</button>
    </form>
  </main>
</body>
</html>`);
}

async function writeAudit(event, request, details) {
  await mkdir(auditDir, { recursive: true });
  const entry = {
    event,
    at: new Date().toISOString(),
    ip: request.socket.remoteAddress,
    userAgent: request.headers["user-agent"],
    ...details
  };
  await appendFile(join(auditDir, "audit.log"), `${JSON.stringify(entry)}\n`);
}
