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
import { basename, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createTrackingQrPng, generateLetterDocx } from "./letter-generator.mjs";

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
const studioSettingsFile = join(dataDir, "studio-settings.json");
const analyticsStoreFile = join(analyticsDir, "visits.json");
const studioPath = "/studio";
const port = Number(process.env.PORT ?? 4173);
const studioUser = process.env.STUDIO_USER ?? "kingsvale";
const studioPassword = process.env.STUDIO_PASSWORD;
const studioMfaSecret = process.env.STUDIO_TOTP_SECRET?.trim() ?? "";
const authTokenSecret = process.env.STUDIO_AUTH_TOKEN_SECRET ?? randomBytes(32).toString("hex");
const cmsEncryptionKey = process.env.CMS_ENCRYPTION_KEY ?? "";
const leadWebhookSecret = process.env.LEAD_WEBHOOK_HMAC_SECRET ?? "";
const royalMailTrackingApiUrl = process.env.ROYAL_MAIL_TRACKING_API_URL ?? "";
const royalMailTrackingApiKey = process.env.ROYAL_MAIL_TRACKING_API_KEY ?? "";
const maxCmsRevisions = clampNumber(process.env.CMS_MAX_REVISIONS, 25, 5, 100);
const maxCmsBackups = clampNumber(process.env.CMS_MAX_BACKUPS, 30, 5, 120);
const backupImportMaxBytes = clampNumber(process.env.BACKUP_IMPORT_MAX_MB, 25, 5, 100) * 1_000_000;
const requestBuckets = new Map();

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.unsplash.com; font-src 'self'; connect-src 'self'; frame-src 'self' https://www.google.com https://earth.google.com https://*.googleusercontent.com; form-action 'self'; base-uri 'none'; frame-ancestors 'self'; object-src 'none'",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
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

    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, url);
      return;
    }

    if (url.pathname.startsWith("/media/")) {
      await serveMedia(url.pathname, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }

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
        tokenMode: "bearer"
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
      expiresAt: new Date(session.expiresAt).toISOString()
    });
    return;
  }

  if (url.pathname === "/api/auth/logout") {
    const session = requireSession(request, response);
    if (!session) {
      return;
    }

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

  if (url.pathname === "/api/backup") {
    await handleBackup(request, response);
    return;
  }

  if (url.pathname === "/api/studio-settings") {
    await handleStudioSettings(request, response);
    return;
  }

  if (url.pathname === "/api/tracking-sites") {
    await handleTrackingSitesCollection(request, response);
    return;
  }

  if (url.pathname === "/api/tracking-sites/lookup") {
    await handleTrackingSiteLookup(request, response);
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
    if (!session) {
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
    if (!session) {
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
    if (!session) {
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await handleImageUpload(request, response, session);
    return;
  }

  if (url.pathname === "/api/uploads/letters") {
    const session = requireSession(request, response);
    if (!session) {
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await handleLetterUpload(request, response, session);
    return;
  }

  if (url.pathname === "/api/letters/generate") {
    const session = requireSession(request, response);
    if (!session) {
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await handleLetterGeneration(request, response, session);
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
  await writeAudit("login_success", request, { user: username });

  if (request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 200, {
      ok: true,
      authenticated: true,
      user: { name: session.user, role: "editor" },
      authToken: session.authToken,
      expiresAt: new Date(session.expiresAt).toISOString()
    });
    return;
  }

  response.writeHead(303, { Location: studioPath });
  response.end();
}

function createSession(user) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
  return {
    user,
    expiresAt,
    authToken: createAuthToken(user, expiresAt)
  };
}

function getSession(request) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload.user || typeof payload.exp !== "number" || payload.exp <= Date.now()) {
      return null;
    }
    return {
      user: String(payload.user),
      expiresAt: payload.exp
    };
  } catch {
    return null;
  }
}

function requireSession(request, response) {
  const session = getSession(request);
  if (!session) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }
  return session;
}

function createAuthToken(user, expiresAt) {
  const payload = Buffer.from(JSON.stringify({ user, exp: expiresAt }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function sign(value) {
  return createHmac("sha256", authTokenSecret).update(value).digest("base64url");
}

function verifySignature(value, signature) {
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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
    const payload = await readJsonBody(request, 8_000_000);
    const site = normalizeTrackingSite(payload.site ?? {});
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
    const existingReferenceOwner = site.reference.trim()
      ? store.sites.find(
          (item) =>
            item.id !== site.id &&
            normalizeLookupText(item.reference) === normalizeLookupText(site.reference)
        )
      : null;
    if (existingReferenceOwner) {
      sendJson(response, 409, { error: "Reference already exists." });
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

async function handleTrackingSiteLookup(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const payload = await readJsonBody(request, 10_000);
  const reference = normalizeLookupText(payload.reference);
  const postcode = normalizePostcode(payload.postcode);
  if (!reference || !postcode) {
    sendJson(response, 400, { error: "Reference and postcode are required." });
    return;
  }

  const store = await readTrackingStore();
  const site = store.sites.find((item) =>
    !item.archived &&
    normalizeLookupText(item.reference) === reference &&
    extractPostcode(item.siteAddress) === postcode
  );

  sendJson(response, site ? 200 : 404, { site: site ? publicTrackingSite(site) : null });
}

async function handleTrackingSiteItem(request, response, url) {
  const [, , , idOrToken, action] = url.pathname.split("/");
  const decodedIdOrToken = decodePathComponent(idOrToken ?? "");

  if (!action && request.method === "GET") {
    const store = await readTrackingStore();
    const site = store.sites.find((item) => item.token === decodedIdOrToken && !item.archived);
    sendJson(response, site ? 200 : 404, { site: site ? publicTrackingSite(site) : null });
    return;
  }

  const session = requireSession(request, response);
  if (!session) {
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

  if (action === "unarchive" && request.method === "POST") {
    const store = await readTrackingStore();
    const target = store.sites.find((site) => site.id === decodedIdOrToken);
    if (!target) {
      sendJson(response, 404, { error: "Tracking site not found." });
      return;
    }

    const restoredSite = {
      ...target,
      archived: false,
      updatedAt: new Date().toISOString()
    };
    store.sites = store.sites.map((site) => (site.id === restoredSite.id ? restoredSite : site));
    store.updatedAt = restoredSite.updatedAt;
    await writeTrackingStore(store);
    await writeAudit("tracking_site_unarchived", request, { user: session.user, siteId: restoredSite.id });
    sendJson(response, 200, { ok: true, site: restoredSite });
    return;
  }

  if (action === "delete" && request.method === "POST") {
    const store = await readTrackingStore();
    const target = store.sites.find((site) => site.id === decodedIdOrToken);
    if (!target) {
      sendJson(response, 404, { error: "Tracking site not found." });
      return;
    }

    store.sites = store.sites.filter((site) => site.id !== decodedIdOrToken);
    store.updatedAt = new Date().toISOString();
    await writeTrackingStore(store);
    await writeAudit("tracking_site_deleted", request, { user: session.user, siteId: target.id });
    sendJson(response, 200, { ok: true, site: target });
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

  if (action === "postal-sync" && request.method === "POST") {
    const store = await readTrackingStore();
    const target = store.sites.find((site) => site.id === decodedIdOrToken);
    if (!target) {
      sendJson(response, 404, { error: "Tracking site not found." });
      return;
    }

    const checkedAt = new Date().toISOString();
    const trackingStatus = await lookupRoyalMailTracking(target.royalMailTrackingNumber);
    const syncedSite = {
      ...target,
      trackingStatus,
      trackingLastCheckedAt: checkedAt,
      mailingLastUpdatedAt: checkedAt,
      updatedAt: checkedAt
    };
    store.sites = store.sites.map((site) => (site.id === syncedSite.id ? syncedSite : site));
    store.updatedAt = checkedAt;
    await writeTrackingStore(store);
    await writeAudit("postal_tracking_checked", request, {
      user: session.user,
      siteId: syncedSite.id,
      configured: Boolean(royalMailTrackingApiUrl && royalMailTrackingApiKey)
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

async function handleBackup(request, response) {
  const session = requireSession(request, response);
  if (!session) {
    return;
  }

  if (request.method === "GET") {
    const backup = await buildFullBackup();
    await writeAudit("backup_exported", request, { user: session.user });
    sendJson(response, 200, { backup });
    return;
  }

  if (request.method === "PUT") {
    const payload = await readJsonBody(request, backupImportMaxBytes);
    const backup = payload.backup;
    const mode = payload.mode === "merge" ? "merge" : "replace";
    const validation = validateBackupPayload(backup);
    if (!validation.valid) {
      sendJson(response, 400, { errors: validation.errors });
      return;
    }

    await mkdir(backupDir, { recursive: true });
    await writeFile(
      join(backupDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-before-import-${toSlug(session.user)}.json`),
      JSON.stringify(await buildFullBackup(), null, 2)
    );
    await applyFullBackup(backup, mode);
    await writeAudit("backup_imported", request, { user: session.user, mode });
    sendJson(response, 200, { ok: true, importedAt: new Date().toISOString(), mode });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function handleStudioSettings(request, response) {
  const session = requireSession(request, response);
  if (!session) {
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, { settings: await readStudioSettings() });
    return;
  }

  if (request.method === "PUT") {
    const payload = await readJsonBody(request, 8_000_000);
    const settings = normalizeStudioSettings(payload.settings ?? {});
    const validation = validateStudioSettings(settings);
    if (!validation.valid) {
      sendJson(response, 400, { errors: validation.errors });
      return;
    }

    const saved = {
      ...settings,
      updatedAt: new Date().toISOString()
    };
    await writeStudioSettings(saved);
    await writeAudit("studio_settings_saved", request, {
      user: session.user,
      letterPresetCount: saved.letterPresets.length
    });
    sendJson(response, 200, { ok: true, settings: saved });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
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

async function handleLetterUpload(request, response, session) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    sendJson(response, 415, { error: "Upload must be multipart/form-data." });
    return;
  }

  const body = await readRequestBody(request, 9_000_000);
  const upload = parseMultipartFile(body, contentType);
  if (!upload) {
    sendJson(response, 400, { error: "Letter file is required." });
    return;
  }

  if (!isAllowedLetterUpload(upload)) {
    sendJson(response, 415, { error: "Only PDF, image, DOC and DOCX letter files up to 8MB are supported." });
    return;
  }

  const extension = normalizeLetterExtension(upload.filename, upload.contentType);
  const slug = toSlug(upload.filename.replace(/\.[^.]+$/, "")) || "letter";
  const filename = `${slug}-${Date.now()}-${randomBytes(4).toString("hex")}${extension}`;
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(join(uploadsDir, filename), upload.data);
  await writeAudit("letter_uploaded", request, {
    user: session.user,
    filename: upload.filename,
    bytes: upload.data.length
  });

  sendJson(response, 201, {
    file: {
      name: upload.filename,
      url: `/media/${filename}`,
      contentType: upload.contentType,
      bytes: upload.data.length
    }
  });
}

async function handleLetterGeneration(request, response, session) {
  const payload = await readJsonBody(request, 1_200_000);
  const site = normalizeTrackingSite(payload.site ?? {});
  const validation = validateTrackingSite(site);
  if (!validation.valid) {
    sendJson(response, 400, { errors: validation.errors });
    return;
  }

  const templateUrl = String(payload.templateUrl ?? site.letterTemplateUrl ?? "");
  if (!templateUrl) {
    sendJson(response, 400, { error: "A DOCX letter template is required." });
    return;
  }

  let templateBuffer;
  try {
    templateBuffer = await readLetterTemplateSource(templateUrl);
  } catch {
    sendJson(response, 400, { error: "Letter template could not be loaded from server media." });
    return;
  }

  const publicLink = String(payload.publicLink ?? "");
  try {
    const qrPng = await createTrackingQrPng(publicLink, site.qrStyle, site.title || site.reference);
    const generated = generateLetterDocx(templateBuffer, site, publicLink, qrPng);
    const slug = toSlug(`${site.reference || site.title || "letter"} generated letter`) || "generated-letter";
    const filename = `${slug}-${Date.now()}-${randomBytes(4).toString("hex")}.docx`;
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, filename), generated);

    await writeAudit("letter_generated", request, {
      user: session.user,
      siteId: site.id,
      templateUrl,
      generated: filename
    });

    sendJson(response, 201, {
      file: {
        name: `${site.reference || site.title || "generated"}-letter.docx`,
        url: `/media/${filename}`,
        contentType: mimeTypes[".docx"],
        bytes: generated.length
      }
    });
  } catch (error) {
    if (error instanceof Error && /^DOCX\b/.test(error.message)) {
      sendJson(response, 400, { error: "Letter template is invalid or too large." });
      return;
    }

    console.error(error);
    sendJson(response, 500, { error: "Letter could not be generated." });
  }
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

function isAllowedLetterUpload(upload) {
  if (!upload || upload.data.length > 8_000_000) {
    return false;
  }

  const extension = normalizeLetterExtension(upload.filename, upload.contentType);
  return Boolean(extension);
}

function normalizeLetterExtension(filename, contentType = "") {
  const extension = extname(filename).toLowerCase();
  const allowedByExtension = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"]);
  if (allowedByExtension.has(extension)) {
    return extension;
  }

  const byType = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"
  };
  return byType[contentType] ?? "";
}

async function readLetterTemplateSource(url) {
  if (url.startsWith("/media/")) {
    if (extname(url).toLowerCase() !== ".docx") {
      throw new Error("Letter template must be DOCX.");
    }
    return readFile(resolveMediaPath(url));
  }

  const dataUrl = url.match(/^data:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document;base64,([a-zA-Z0-9+/=]+)$/);
  if (dataUrl) {
    return Buffer.from(dataUrl[1], "base64");
  }

  throw new Error("Unsupported letter template source.");
}

function resolveMediaPath(url) {
  const safePath = normalize(decodePathComponent(url.replace(/^\/media\//, ""))).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(uploadsDir, safePath);
  if (!isPathInside(uploadsDir, candidate)) {
    throw new HttpError(404, "Media not found.");
  }
  return candidate;
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

async function readStudioSettings() {
  try {
    const raw = await readFile(studioSettingsFile, "utf8");
    return normalizeStudioSettings(decodeCmsStore(raw));
  } catch {
    return defaultStudioSettings();
  }
}

async function writeStudioSettings(settings) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(studioSettingsFile, encodeCmsStore(normalizeStudioSettings(settings)));
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

async function buildFullBackup() {
  return {
    kind: "kingsvale-full-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    stores: {
      cms: await readCmsStore(),
      tracking: await readTrackingStore(),
      settings: await readStudioSettings(),
      analytics: await readAnalyticsStore(),
      leads: await readLeadStores()
    }
  };
}

async function applyFullBackup(backup, mode) {
  const now = new Date().toISOString();
  const stores = backup.stores;

  if (mode === "merge") {
    const currentTracking = await readTrackingStore();
    const importedSites = stores.tracking.sites.map(normalizeTrackingSite);
    const mergedSites = [
      ...importedSites,
      ...currentTracking.sites.filter((site) => !importedSites.some((item) => item.id === site.id))
    ];
    await writeTrackingStore({ sites: mergedSites, updatedAt: now });

    const currentAnalytics = await readAnalyticsStore();
    const mergedVisits = [...stores.analytics.visits, ...currentAnalytics.visits].slice(0, 5_000);
    await writeAnalyticsStore({ visits: mergedVisits.filter(isAnalyticsVisit), updatedAt: now });
    await appendLeadStores(stores.leads);
    await writeCmsStore({ ...stores.cms, updatedAt: now });
    await writeStudioSettings(mergeStudioSettings(await readStudioSettings(), stores.settings));
    return;
  }

  await writeCmsStore({ ...stores.cms, updatedAt: now });
  await writeTrackingStore({
    sites: stores.tracking.sites.map(normalizeTrackingSite).filter((site) => validateTrackingSite(site).valid),
    updatedAt: now
  });
  await writeAnalyticsStore({
    visits: stores.analytics.visits.filter(isAnalyticsVisit),
    updatedAt: now
  });
  await writeStudioSettings(normalizeStudioSettings(stores.settings));
  await writeLeadStores(stores.leads);
}

async function readLeadStores() {
  return {
    contact: await readTextFile(join(leadsDir, "contact.jsonl")),
    newsletter: await readTextFile(join(leadsDir, "newsletter.jsonl"))
  };
}

async function readTextFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function writeLeadStores(leads) {
  await mkdir(leadsDir, { recursive: true });
  await writeFile(join(leadsDir, "contact.jsonl"), String(leads?.contact ?? ""));
  await writeFile(join(leadsDir, "newsletter.jsonl"), String(leads?.newsletter ?? ""));
}

async function appendLeadStores(leads) {
  await mkdir(leadsDir, { recursive: true });
  if (leads?.contact) {
    await appendFile(join(leadsDir, "contact.jsonl"), String(leads.contact));
  }
  if (leads?.newsletter) {
    await appendFile(join(leadsDir, "newsletter.jsonl"), String(leads.newsletter));
  }
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
    return parseJsonBody(raw);
  }

  const params = new URLSearchParams(raw.toString("utf8"));
  return Object.fromEntries(params.entries());
}

async function readJsonBody(request, limit) {
  const raw = await readRequestBody(request, limit);
  return parseJsonBody(raw);
}

async function readRequestBody(request, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > limit) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseJsonBody(raw) {
  try {
    return JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
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
  validateText(errors, "siteAddressParts.line1", site.siteAddressParts?.line1, "Address line 1", 90);
  validateOptionalText(errors, "siteAddressParts.line2", site.siteAddressParts?.line2 ?? "", "Address line 2", 90);
  validateText(errors, "siteAddressParts.town", site.siteAddressParts?.town, "Town or city", 70);
  validateOptionalText(errors, "siteAddressParts.county", site.siteAddressParts?.county ?? "", "County", 70);
  validateText(errors, "siteAddressParts.postcode", site.siteAddressParts?.postcode, "Postcode", 12);
  if (site.siteAddressParts?.postcode && !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(String(site.siteAddressParts.postcode).trim())) {
    errors.push({ path: "siteAddressParts.postcode", message: "Use a valid UK postcode." });
  }
  validateText(errors, "statusNote", site.statusNote, "Status note", 320);
  validateOptionalText(errors, "customerName", site.customerName, "Customer name", 80);
  validateOptionalText(errors, "ownerAddress", site.ownerAddress, "Owner postal address", 220);
  validateOptionalText(errors, "titleNumber", site.titleNumber, "Title number", 80);
  validateOptionalText(errors, "plotDescription", site.plotDescription, "Plot description", 220);
  validateOptionalText(errors, "reference", site.reference, "Reference", 64);
  validateOptionalText(errors, "region", site.region, "Region", 80);
  validateOptionalText(errors, "mapEmbedUrl", site.mapEmbedUrl, "Google My Maps embed URL", 1200);
  if (site.mapEmbedUrl && !isSafeMapEmbedUrl(site.mapEmbedUrl)) {
    errors.push({ path: "mapEmbedUrl", message: "Google My Maps embed must be a safe Google map URL." });
  }
  validateOptionalText(errors, "privateNotes", site.privateNotes, "Private note", 1200);
  validateOptionalText(errors, "letterPresetId", site.letterPresetId, "Letter preset", 120);
  if (!["legal-owner", "title-owner", "plot-land"].includes(site.letterRecipientMode)) {
    errors.push({ path: "letterRecipientMode", message: "Choose an approved letter recipient mode." });
  }
  validateOptionalText(errors, "titleDeedFileName", site.titleDeedFileName, "Title deed filename", 160);
  if (site.titleDeedFileUrl && (site.titleDeedFileUrl.length > 7_000_000 || !isSafeLetterUrl(site.titleDeedFileUrl))) {
    errors.push({ path: "titleDeedFileUrl", message: "Title deed upload must be a PDF, image or Word document under the upload limit." });
  }
  validateOptionalText(errors, "letterTemplateName", site.letterTemplateName, "Letter template filename", 160);
  if (site.letterTemplateUrl && (site.letterTemplateUrl.length > 7_000_000 || !isSafeLetterTemplateUrl(site.letterTemplateUrl))) {
    errors.push({ path: "letterTemplateUrl", message: "Letter template must be a DOCX file stored on the server." });
  }
  validateOptionalText(errors, "letterFileName", site.letterFileName, "Letter filename", 160);
  if (site.letterFileUrl && (site.letterFileUrl.length > 7_000_000 || !isSafeLetterUrl(site.letterFileUrl))) {
    errors.push({ path: "letterFileUrl", message: "Letter upload must be a PDF, image or Word document under the upload limit." });
  }
  validateOptionalText(errors, "searchlandUrl", site.searchlandUrl, "Searchland URL", 1200);
  if (site.searchlandUrl && !isSafeSearchlandUrl(site.searchlandUrl)) {
    errors.push({ path: "searchlandUrl", message: "Searchland URL must be a safe Searchland link." });
  }

  if (!["high", "medium", "low", "do-not-contact", "unknown"].includes(site.contactPriority)) {
    errors.push({ path: "contactPriority", message: "Choose an approved contact priority." });
  }

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

  validateMailing(errors, site);

  return { valid: errors.length === 0, errors };
}

function validateBackupPayload(backup) {
  const errors = [];
  if (!backup || typeof backup !== "object") {
    return { valid: false, errors: [{ path: "backup", message: "Backup file is required." }] };
  }
  if (backup.kind !== "kingsvale-full-backup") {
    errors.push({ path: "kind", message: "This is not a Kingsvale full backup." });
  }
  const stores = backup.stores;
  if (!stores || typeof stores !== "object") {
    errors.push({ path: "stores", message: "Backup stores are missing." });
    return { valid: false, errors };
  }
  if (!stores.cms || typeof stores.cms !== "object") {
    errors.push({ path: "stores.cms", message: "CMS store is missing." });
  }
  if (!stores.tracking || !Array.isArray(stores.tracking.sites)) {
    errors.push({ path: "stores.tracking", message: "Tracking store is missing." });
  } else {
    stores.tracking.sites.forEach((site, index) => {
      const validation = validateTrackingSite(normalizeTrackingSite(site));
      validation.errors.forEach((error) => {
        errors.push({ path: `stores.tracking.sites.${index}.${error.path}`, message: error.message });
      });
    });
  }
  if (stores.settings) {
    const settingsValidation = validateStudioSettings(normalizeStudioSettings(stores.settings));
    settingsValidation.errors.forEach((error) => {
      errors.push({ path: `stores.settings.${error.path}`, message: error.message });
    });
  }
  if (!stores.analytics || !Array.isArray(stores.analytics.visits)) {
    errors.push({ path: "stores.analytics", message: "Analytics store is missing." });
  }
  if (!stores.leads || typeof stores.leads !== "object") {
    errors.push({ path: "stores.leads", message: "Lead store is missing." });
  }
  return { valid: errors.length === 0, errors };
}

function validateStudioSettings(settings) {
  const errors = [];
  if (!settings || typeof settings !== "object") {
    return { valid: false, errors: [{ path: "settings", message: "Studio settings are required." }] };
  }

  if (!Array.isArray(settings.letterPresets) || settings.letterPresets.length > 20) {
    errors.push({ path: "letterPresets", message: "Use up to 20 letter presets." });
  } else {
    settings.letterPresets.forEach((preset, index) => {
      validateText(errors, `letterPresets.${index}.name`, preset.name, "Preset name", 80);
      validateText(errors, `letterPresets.${index}.templateName`, preset.templateName, "Template filename", 160);
      if (typeof preset.templateUrl !== "string" || preset.templateUrl.length > 7_000_000 || !isSafeLetterTemplateUrl(preset.templateUrl)) {
        errors.push({ path: `letterPresets.${index}.templateUrl`, message: "Letter preset must use a safe DOCX template." });
      }
      if (!["legal-owner", "title-owner", "plot-land"].includes(preset.recipientMode)) {
        errors.push({ path: `letterPresets.${index}.recipientMode`, message: "Choose an approved recipient mode." });
      }
    });
  }

  if (!Number.isFinite(settings.defaultReminderDays) || settings.defaultReminderDays < 1 || settings.defaultReminderDays > 120) {
    errors.push({ path: "defaultReminderDays", message: "Default reminder days must be between 1 and 120." });
  }

  if (!["high", "medium", "low", "do-not-contact", "unknown"].includes(settings.defaultContactPriority)) {
    errors.push({ path: "defaultContactPriority", message: "Choose an approved default priority." });
  }

  return { valid: errors.length === 0, errors };
}

function validateMailing(errors, site) {
  if (![
    "not-mailed",
    "ready-to-mail",
    "mailed",
    "delivered",
    "responded",
    "no-response",
    "second-letter-needed",
    "do-not-contact"
  ].includes(site.mailingStatus)) {
    errors.push({ path: "mailingStatus", message: "Choose an approved mailing status." });
  }

  validateOptionalText(errors, "royalMailTrackingNumber", site.royalMailTrackingNumber, "Royal Mail tracking number", 40);
  validateOptionalText(errors, "trackingStatus", site.trackingStatus, "Tracking status", 140);
  validateOptionalText(errors, "mailingNotes", site.mailingNotes, "Mailing notes", 1200);

  if (!Number.isFinite(site.remailReminderDays) || site.remailReminderDays < 1 || site.remailReminderDays > 120) {
    errors.push({ path: "remailReminderDays", message: "Reminder days must be between 1 and 120." });
  }

  for (const [path, value] of [
    ["firstMailedAt", site.firstMailedAt],
    ["lastMailedAt", site.lastMailedAt],
    ["remailReminderDate", site.remailReminderDate]
  ]) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors.push({ path, message: "Use a valid date." });
    }
  }
}

function defaultStudioSettings() {
  return {
    letterPresets: [],
    defaultReminderDays: 14,
    defaultContactPriority: "unknown",
    updatedAt: new Date().toISOString()
  };
}

function normalizeStudioSettings(settings = {}) {
  const fallback = defaultStudioSettings();
  return {
    letterPresets: Array.isArray(settings.letterPresets)
      ? settings.letterPresets.map(normalizeLetterPreset).filter(Boolean)
      : [],
    defaultReminderDays: boundedReminderDays(settings.defaultReminderDays),
    defaultContactPriority: normalizeContactPriority(settings.defaultContactPriority),
    updatedAt: typeof settings.updatedAt === "string" && settings.updatedAt ? settings.updatedAt : fallback.updatedAt
  };
}

function normalizeLetterPreset(preset = {}) {
  const name = cleanText(preset.name).slice(0, 80);
  const templateName = cleanText(preset.templateName).slice(0, 160);
  const templateUrl = cleanText(preset.templateUrl);
  if (!name || !templateName || !isSafeLetterTemplateUrl(templateUrl)) {
    return null;
  }

  return {
    id: cleanText(preset.id).slice(0, 120) || `letter-preset-${Date.now()}-${randomBytes(3).toString("hex")}`,
    name,
    templateName,
    templateUrl,
    recipientMode: normalizeLetterRecipientMode(preset.recipientMode),
    createdAt: cleanText(preset.createdAt) || new Date().toISOString()
  };
}

function mergeStudioSettings(current, imported) {
  const currentSettings = normalizeStudioSettings(current);
  const importedSettings = normalizeStudioSettings(imported);
  return {
    ...currentSettings,
    ...importedSettings,
    letterPresets: [
      ...importedSettings.letterPresets,
      ...currentSettings.letterPresets.filter(
        (preset) => !importedSettings.letterPresets.some((item) => item.id === preset.id)
      )
    ],
    updatedAt: new Date().toISOString()
  };
}

function normalizeTrackingSite(site) {
  const qrStyle = site.qrStyle ?? {};
  const council = site.council ?? {};
  const firstMailedAt = site.firstMailedAt ?? "";
  const remailReminderDays = boundedReminderDays(site.remailReminderDays);
  const siteAddressParts = normalizeAddressParts(site.siteAddressParts, site.siteAddress);
  const siteAddress = buildAddressFromParts(siteAddressParts) || site.siteAddress || "";
  return {
    ...site,
    siteAddress,
    siteAddressParts,
    region: site.region || detectSiteRegion(siteAddress) || siteAddressParts.county || siteAddressParts.town || "Uncategorised",
    ownerAddress: site.ownerAddress ?? "",
    titleNumber: site.titleNumber ?? "",
    plotDescription: site.plotDescription ?? "",
    ownerContactName: site.ownerContactName ?? "",
    contactPriority: normalizeContactPriority(site.contactPriority),
    mapEmbedUrl: normalizeMapEmbedInput(site.mapEmbedUrl ?? ""),
    privateNotes: site.privateNotes ?? "",
    letterPresetId: site.letterPresetId ?? "",
    letterRecipientMode: normalizeLetterRecipientMode(site.letterRecipientMode),
    titleDeedFileName: site.titleDeedFileName ?? "",
    titleDeedFileUrl: site.titleDeedFileUrl ?? "",
    letterTemplateName: site.letterTemplateName ?? "",
    letterTemplateUrl: site.letterTemplateUrl ?? "",
    letterFileName: site.letterFileName ?? "",
    letterFileUrl: site.letterFileUrl ?? "",
    searchlandUrl: site.searchlandUrl ?? "",
    resources: Array.isArray(site.resources) ? site.resources : [],
    qrStyle: {
      foreground: qrStyle.foreground ?? "#22211d",
      background: qrStyle.background ?? "#fbf8f2",
      accent: qrStyle.accent ?? "#ad9576",
      dotRoundness: numberOrFallback(qrStyle.dotRoundness, presetRoundness(qrStyle.dotStyle)),
      finderRoundness: numberOrFallback(qrStyle.finderRoundness, presetRoundness(qrStyle.finderStyle)),
      frameRoundness: numberOrFallback(qrStyle.frameRoundness, qrStyle.frameStyle === "square" ? 0 : 42),
      frameCut: numberOrFallback(qrStyle.frameCut, qrStyle.frameStyle === "cut-corner" ? 36 : 0),
      frameLabel: qrStyle.frameLabel ?? "Scan to view the plot",
      includeLogo: qrStyle.includeLogo ?? true
    },
    council: {
      mode: council.mode ?? "none",
      councilName: council.councilName ?? "",
      applicationReference: council.applicationReference ?? "",
      apiBaseUrl: council.apiBaseUrl ?? "",
      lastCheckedAt: council.lastCheckedAt ?? null,
      lastSyncStatus: council.lastSyncStatus ?? "Not configured"
    },
    mailingStatus: normalizeMailingStatus(site.mailingStatus),
    firstMailedAt,
    lastMailedAt: site.lastMailedAt ?? "",
    royalMailTrackingNumber: site.royalMailTrackingNumber ?? "",
    trackingStatus: site.trackingStatus ?? "Tracking unavailable",
    trackingLastCheckedAt: site.trackingLastCheckedAt ?? null,
    remailReminderDays,
    remailReminderDate: site.remailReminderDate || suggestRemailReminderDate(firstMailedAt, remailReminderDays),
    mailingNotes: site.mailingNotes ?? "",
    mailingLastUpdatedAt: site.mailingLastUpdatedAt ?? site.updatedAt ?? new Date().toISOString()
  };
}

function publicTrackingSite(site) {
  const {
    ownerContactName,
    ownerAddress,
    titleNumber,
    plotDescription,
    contactPriority,
    mailingStatus,
    firstMailedAt,
    lastMailedAt,
    royalMailTrackingNumber,
    trackingStatus,
    trackingLastCheckedAt,
    privateNotes,
    letterPresetId,
    letterRecipientMode,
    titleDeedFileName,
    titleDeedFileUrl,
    letterTemplateName,
    letterTemplateUrl,
    letterFileName,
    letterFileUrl,
    searchlandUrl,
    remailReminderDays,
    remailReminderDate,
    mailingNotes,
    mailingLastUpdatedAt,
    ...publicSite
  } = site;
  void ownerContactName;
  void ownerAddress;
  void titleNumber;
  void plotDescription;
  void contactPriority;
  void mailingStatus;
  void firstMailedAt;
  void lastMailedAt;
  void royalMailTrackingNumber;
  void trackingStatus;
  void trackingLastCheckedAt;
  void privateNotes;
  void letterPresetId;
  void letterRecipientMode;
  void titleDeedFileName;
  void titleDeedFileUrl;
  void letterTemplateName;
  void letterTemplateUrl;
  void letterFileName;
  void letterFileUrl;
  void searchlandUrl;
  void remailReminderDays;
  void remailReminderDate;
  void mailingNotes;
  void mailingLastUpdatedAt;
  return publicSite;
}

function normalizeMapEmbedInput(value) {
  const trimmed = String(value ?? "").trim();
  const iframeSrc = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  return preferSatelliteMap(decodeHtmlAttribute(iframeSrc ?? trimmed));
}

function preferSatelliteMap(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (url.hostname === "www.google.com" && url.pathname.includes("/maps/d/embed")) {
      // Google My Maps does not reliably expose a documented satellite default.
      // This query parameter is the closest safe hint when the embed honours it.
      url.searchParams.set("basemap", "satellite");
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function detectSiteRegion(address = "") {
  const text = String(address).toLowerCase();
  const knownRegions = [
    "Wokingham",
    "Hampshire",
    "Berkshire",
    "Surrey",
    "London",
    "Reading",
    "Guildford",
    "Winchester",
    "Bracknell",
    "Basingstoke",
    "Hart"
  ];
  return knownRegions.find((region) => text.includes(region.toLowerCase())) ?? "";
}

function buildAddressFromParts(parts = {}) {
  return [
    parts.line1,
    parts.line2,
    parts.town,
    parts.county,
    String(parts.postcode ?? "").toUpperCase()
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeAddressParts(parts = {}, fallbackAddress = "") {
  const parsed = parseAddressParts(fallbackAddress);
  return {
    line1: stringValue(parts.line1, parsed.line1),
    line2: stringValue(parts.line2, parsed.line2),
    town: stringValue(parts.town, parsed.town),
    county: stringValue(parts.county, parsed.county),
    postcode: stringValue(parts.postcode, parsed.postcode).toUpperCase()
  };
}

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function parseAddressParts(value = "") {
  const text = String(value ?? "").trim();
  const postcode = extractPostcode(text);
  const withoutPostcode = postcode
    ? text.replace(new RegExp(`${escapeRegExp(postcode)}\\s*$`, "i"), "").trim()
    : text;
  const parts = withoutPostcode
    .split(/\s*,\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    line1: parts[0] ?? text,
    line2: parts.length > 3 ? parts.slice(1, -2).join(", ") : parts.length === 3 ? parts[1] ?? "" : "",
    town: parts.length > 3 ? parts.at(-2) ?? "" : parts.length > 1 ? parts.at(-1) ?? "" : "",
    county: parts.length > 3 ? parts.at(-1) ?? "" : "",
    postcode
  };
}

function extractPostcode(address = "") {
  const match = String(address).toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match ? normalizePostcode(match[1]) : "";
}

function normalizePostcode(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLookupText(value = "") {
  return String(value).trim().toUpperCase();
}

async function lookupRoyalMailTracking(trackingNumber) {
  if (!trackingNumber?.trim()) {
    return "No Royal Mail tracking number";
  }

  if (!royalMailTrackingApiUrl || !royalMailTrackingApiKey) {
    return "Tracking API not configured";
  }

  try {
    const url = new URL(royalMailTrackingApiUrl);
    url.searchParams.set("trackingNumber", trackingNumber.trim());
    // Configure ROYAL_MAIL_TRACKING_API_URL and ROYAL_MAIL_TRACKING_API_KEY in the runtime environment.
    // The endpoint should return JSON with a human-readable status field or summary field.
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${royalMailTrackingApiKey}`
      }
    });

    if (!response.ok) {
      return "Tracking unavailable";
    }

    const payload = await response.json();
    const status = payload.status ?? payload.summary ?? payload.trackingStatus;
    return typeof status === "string" && status.trim() ? status.trim().slice(0, 140) : "Tracking checked";
  } catch {
    return "Tracking unavailable";
  }
}

function normalizeContactPriority(value) {
  return ["high", "medium", "low", "do-not-contact", "unknown"].includes(value) ? value : "unknown";
}

function normalizeMailingStatus(value) {
  return [
    "not-mailed",
    "ready-to-mail",
    "mailed",
    "delivered",
    "responded",
    "no-response",
    "second-letter-needed",
    "do-not-contact"
  ].includes(value)
    ? value
    : "not-mailed";
}

function normalizeLetterRecipientMode(value) {
  return ["legal-owner", "title-owner", "plot-land"].includes(value) ? value : "legal-owner";
}

function boundedReminderDays(value) {
  return Number.isFinite(value) ? Math.min(120, Math.max(1, Math.trunc(value))) : 14;
}

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function suggestRemailReminderDate(firstMailedAt, reminderDays = 14) {
  if (!firstMailedAt) {
    return "";
  }

  const date = new Date(`${firstMailedAt}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + boundedReminderDays(reminderDays));
  return date.toISOString().slice(0, 10);
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

function isSafeMapEmbedUrl(value) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (
        url.hostname === "google.com" ||
        url.hostname === "www.google.com" ||
        url.hostname.endsWith(".google.com") ||
        url.hostname === "earth.google.com" ||
        url.hostname.endsWith(".googleusercontent.com")
      )
    );
  } catch {
    return false;
  }
}

function isSafeLetterUrl(value) {
  if (value.startsWith("/media/")) {
    try {
      resolveMediaPath(value);
      return [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"].includes(extname(value).toLowerCase());
    } catch {
      return false;
    }
  }

  return /^data:(application\/pdf|image\/png|image\/jpeg|image\/webp|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,[a-zA-Z0-9+/=]+$/.test(value);
}

function isSafeLetterTemplateUrl(value) {
  if (value.startsWith("/media/")) {
    try {
      resolveMediaPath(value);
      return extname(value).toLowerCase() === ".docx";
    } catch {
      return false;
    }
  }

  return /^data:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document;base64,[a-zA-Z0-9+/=]+$/.test(value);
}

function isSafeSearchlandUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "app.searchland.co.uk" || url.hostname.endsWith(".searchland.co.uk"))
    );
  } catch {
    return false;
  }
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

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

async function serveMedia(pathname, response) {
  const safePath = normalize(decodePathComponent(pathname.replace(/^\/media\//, ""))).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(uploadsDir, safePath);
  if (!isPathInside(uploadsDir, candidate)) {
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
  const safePath = normalize(decodePathComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(distDir, safePath.slice(1));
  if (!isPathInside(distDir, candidate)) {
    return join(distDir, "index.html");
  }
  return candidate;
}

function decodePathComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "Malformed request path.");
  }
}

function isPathInside(parent, candidate) {
  const relation = relative(parent, candidate);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
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
