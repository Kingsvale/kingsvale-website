import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { normalizeTrackingSite } from "./src/lib/trackingNormalize";
import type { TrackingSite } from "./src/lib/trackingTypes";
import { validateTrackingSite } from "./src/lib/trackingValidation";
// @ts-expect-error server helper is intentionally authored as runtime ESM for production Node.
import { createTrackingQrPng, generateLetterDocx } from "./server/letter-generator.mjs";

export default defineConfig({
  plugins: [devTrackingApi(), react()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");

          if (
            normalizedId.includes("vite/preload-helper") ||
            normalizedId.includes("/src/pages/Homepage") ||
            normalizedId.includes("/src/components/") ||
            normalizedId.includes("/src/data/defaultContent") ||
            normalizedId.includes("/src/hooks/") ||
            normalizedId.includes("/src/lib/contentTypes") ||
            normalizedId.includes("/src/lib/contentValidation") ||
            normalizedId.includes("/src/lib/formSubmit") ||
            normalizedId.includes("/src/lib/imageUtils") ||
            normalizedId.includes("/src/lib/seo") ||
            normalizedId.includes("/src/lib/serverContent") ||
            normalizedId.includes("/src/lib/storage") ||
            normalizedId.includes("/src/lib/studioRoute") ||
            normalizedId.endsWith("/src/lib/analytics.ts")
          ) {
            return "public-core";
          }

          if (
            normalizedId.includes("/src/pages/AdminPage") ||
            normalizedId.includes("/src/pages/StudioAuthPage") ||
            normalizedId.includes("/src/lib/cmsApi") ||
            normalizedId.includes("/src/lib/studioSecurity")
          ) {
            return "studio";
          }

        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 15_000,
    setupFiles: "./src/test/setup.ts",
    css: true,
    coverage: {
      reporter: ["text", "html"]
    }
  }
});

const devTrackingStoreFile = resolve("data/dev-tracking-sites.json");
const devUploadsDir = resolve("data/uploads");
const devMimeTypes: Record<string, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp"
};

type DevTrackingStore = {
  sites: TrackingSite[];
  updatedAt: string | null;
};

function devTrackingApi(): Plugin {
  return {
    name: "kingsvale-dev-tracking-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (url.pathname.startsWith("/media/")) {
          await serveDevMedia(url.pathname, response);
          return;
        }

        if (url.pathname === "/api/backup" && request.method === "PUT") {
          try {
            await handleDevBackupImport(request, response);
          } catch (error) {
            console.error(error);
            sendDevJson(response, 500, { error: "Development backup import failed." });
          }
          return;
        }

        if (url.pathname === "/api/uploads/letters") {
          try {
            await handleDevLetterUpload(request, response);
          } catch (error) {
            console.error(error);
            sendDevJson(response, 500, { error: "Development letter upload failed." });
          }
          return;
        }

        if (url.pathname === "/api/letters/generate") {
          try {
            await handleDevLetterGeneration(request, response);
          } catch (error) {
            console.error(error);
            sendDevJson(response, 500, { error: "Development letter generation failed." });
          }
          return;
        }

        if (!url.pathname.startsWith("/api/tracking-sites")) {
          next();
          return;
        }

        try {
          await handleDevTrackingRequest(request, response, url);
        } catch (error) {
          console.error(error);
          sendDevJson(response, 500, { error: "Development tracking API failed." });
        }
      });
    }
  };
}

async function handleDevTrackingRequest(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (url.pathname === "/api/tracking-sites") {
    if (request.method === "GET") {
      const store = await readDevTrackingStore();
      sendDevJson(response, 200, { sites: store.sites, storage: "dev-file" });
      return;
    }

    if (request.method === "PUT") {
      const payload = await readDevJsonBody(request, 8_000_000);
      const site = normalizeTrackingSite(payload.site ?? {});
      const validation = validateTrackingSite(site);
      if (!validation.valid) {
        sendDevJson(response, 400, { errors: validation.errors });
        return;
      }

      const store = await readDevTrackingStore();
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
      await writeDevTrackingStore(store);
      sendDevJson(response, 200, { ok: true, site: savedSite, storage: "dev-file" });
      return;
    }

    sendDevJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (url.pathname === "/api/tracking-sites/lookup") {
    if (request.method !== "POST") {
      sendDevJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const payload = await readDevJsonBody(request, 10_000);
    const reference = normalizeLookupText(payload.reference);
    const postcode = normalizePostcode(payload.postcode);
    const store = await readDevTrackingStore();
    const site = store.sites.find((item) =>
      !item.archived &&
      normalizeLookupText(item.reference) === reference &&
      extractPostcode(item.siteAddress) === postcode
    );
    sendDevJson(response, site ? 200 : 404, { site: site ? publicDevTrackingSite(site) : null });
    return;
  }

  const [, , , idOrToken, action] = url.pathname.split("/");
  const decodedIdOrToken = decodeURIComponent(idOrToken ?? "");

  if (!action && request.method === "GET") {
    const store = await readDevTrackingStore();
    const site = store.sites.find((item) => item.token === decodedIdOrToken && !item.archived);
    sendDevJson(response, site ? 200 : 404, { site: site ? publicDevTrackingSite(site) : null });
    return;
  }

  if (action === "archive" && request.method === "POST") {
    const store = await readDevTrackingStore();
    const target = store.sites.find((site) => site.id === decodedIdOrToken);
    if (!target) {
      sendDevJson(response, 404, { error: "Tracking site not found." });
      return;
    }

    const archivedSite = { ...target, archived: true, updatedAt: new Date().toISOString() };
    store.sites = store.sites.map((site) => (site.id === archivedSite.id ? archivedSite : site));
    store.updatedAt = archivedSite.updatedAt;
    await writeDevTrackingStore(store);
    sendDevJson(response, 200, { ok: true, site: archivedSite, storage: "dev-file" });
    return;
  }

  if (action === "unarchive" && request.method === "POST") {
    const restoredSite = await updateDevTrackingSite(decodedIdOrToken, (site) => ({
      ...site,
      archived: false
    }));
    sendDevJson(response, restoredSite ? 200 : 404, restoredSite ? { ok: true, site: restoredSite, storage: "dev-file" } : { error: "Tracking site not found." });
    return;
  }

  if (action === "delete" && request.method === "POST") {
    const store = await readDevTrackingStore();
    const target = store.sites.find((site) => site.id === decodedIdOrToken);
    if (!target) {
      sendDevJson(response, 404, { error: "Tracking site not found." });
      return;
    }

    store.sites = store.sites.filter((site) => site.id !== target.id);
    store.updatedAt = new Date().toISOString();
    await writeDevTrackingStore(store);
    sendDevJson(response, 200, { ok: true, site: target, storage: "dev-file" });
    return;
  }

  if (action === "sync" && request.method === "POST") {
    const synced = await updateDevTrackingSite(decodedIdOrToken, (site) => ({
      ...site,
      council: {
        ...site.council,
        lastCheckedAt: new Date().toISOString(),
        lastSyncStatus: "Development API shell only. Configure a council API in production."
      }
    }));
    sendDevJson(response, synced ? 200 : 404, synced ? { ok: true, site: synced, storage: "dev-file" } : { error: "Tracking site not found." });
    return;
  }

  if (action === "postal-sync" && request.method === "POST") {
    const checkedAt = new Date().toISOString();
    const synced = await updateDevTrackingSite(decodedIdOrToken, (site) => ({
      ...site,
      trackingStatus: site.royalMailTrackingNumber ? "Tracking API not configured" : "No Royal Mail tracking number",
      trackingLastCheckedAt: checkedAt,
      mailingLastUpdatedAt: checkedAt
    }));
    sendDevJson(response, synced ? 200 : 404, synced ? { ok: true, site: synced, storage: "dev-file" } : { error: "Tracking site not found." });
    return;
  }

  sendDevJson(response, 405, { error: "Method not allowed." });
}

async function handleDevBackupImport(request: IncomingMessage, response: ServerResponse) {
  const payload = await readDevJsonBody(request, 25_000_000);
  const backup = payload.backup as { stores?: { tracking?: { sites?: TrackingSite[] } } } | undefined;
  const mode = payload.mode === "merge" ? "merge" : "replace";
  const importedSites = Array.isArray(backup?.stores?.tracking?.sites)
    ? backup.stores.tracking.sites.map(normalizeTrackingSite)
    : [];
  const invalidSite = importedSites.find((site) => !validateTrackingSite(site).valid);

  if (!backup || invalidSite) {
    sendDevJson(response, 400, { error: "Backup tracking records are invalid." });
    return;
  }

  const currentStore = await readDevTrackingStore();
  const nextSites = mode === "merge"
    ? [
        ...importedSites,
        ...currentStore.sites.filter((site) => !importedSites.some((imported) => imported.id === site.id))
      ]
    : importedSites;
  const updatedAt = new Date().toISOString();
  await writeDevTrackingStore({ sites: nextSites, updatedAt });
  sendDevJson(response, 200, { ok: true, importedAt: updatedAt, mode, storage: "dev-file" });
}

async function handleDevLetterUpload(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    sendDevJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    sendDevJson(response, 415, { error: "Upload must be multipart/form-data." });
    return;
  }

  const body = await readDevRequestBody(request, 9_000_000);
  const upload = parseDevMultipartFile(body, contentType);
  if (!upload || !isAllowedDevLetterUpload(upload)) {
    sendDevJson(response, 415, { error: "Only PDF, image, DOC and DOCX letter files up to 8MB are supported." });
    return;
  }

  const extension = normalizeDevLetterExtension(upload.filename, upload.contentType);
  const slug = toDevSlug(upload.filename.replace(/\.[^.]+$/, "")) || "letter";
  const filename = `${slug}-${Date.now()}-${randomBytes(4).toString("hex")}${extension}`;
  await mkdir(devUploadsDir, { recursive: true });
  await writeFile(join(devUploadsDir, filename), upload.data);
  sendDevJson(response, 201, {
    file: {
      name: upload.filename,
      url: `/media/${filename}`,
      contentType: upload.contentType,
      bytes: upload.data.length
    }
  });
}

async function handleDevLetterGeneration(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    sendDevJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const payload = await readDevJsonBody(request, 1_200_000);
  const site = normalizeTrackingSite(payload.site ?? {} as TrackingSite);
  const validation = validateTrackingSite(site);
  if (!validation.valid) {
    sendDevJson(response, 400, { errors: validation.errors });
    return;
  }

  const templateUrl = String(payload.templateUrl ?? site.letterTemplateUrl ?? "");
  if (!templateUrl.startsWith("/media/") || extname(templateUrl).toLowerCase() !== ".docx") {
    sendDevJson(response, 400, { error: "A server-uploaded DOCX template is required." });
    return;
  }

  const template = await readFile(resolveDevMediaPath(templateUrl));
  const publicLink = String(payload.publicLink ?? "");
  const qrPng = await createTrackingQrPng(publicLink, site.qrStyle, site.title || site.reference);
  const generated = generateLetterDocx(template, site, publicLink, qrPng);
  const slug = toDevSlug(`${site.reference || site.title || "letter"} generated letter`) || "generated-letter";
  const filename = `${slug}-${Date.now()}-${randomBytes(4).toString("hex")}.docx`;
  await mkdir(devUploadsDir, { recursive: true });
  await writeFile(join(devUploadsDir, filename), generated);
  sendDevJson(response, 201, {
    file: {
      name: `${site.reference || site.title || "generated"}-letter.docx`,
      url: `/media/${filename}`,
      contentType: devMimeTypes[".docx"],
      bytes: generated.length
    }
  });
}

async function updateDevTrackingSite(id: string, recipe: (site: TrackingSite) => TrackingSite) {
  const store = await readDevTrackingStore();
  const target = store.sites.find((site) => site.id === id);
  if (!target) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const updatedSite = { ...recipe(target), updatedAt };
  store.sites = store.sites.map((site) => (site.id === updatedSite.id ? updatedSite : site));
  store.updatedAt = updatedAt;
  await writeDevTrackingStore(store);
  return updatedSite;
}

async function readDevTrackingStore(): Promise<DevTrackingStore> {
  try {
    const parsed = JSON.parse(await readFile(devTrackingStoreFile, "utf8")) as Partial<DevTrackingStore>;
    const sites = Array.isArray(parsed.sites)
      ? parsed.sites.map(normalizeTrackingSite).filter((site) => validateTrackingSite(site).valid)
      : [];
    return { sites, updatedAt: parsed.updatedAt ?? null };
  } catch {
    return { sites: [], updatedAt: null };
  }
}

async function writeDevTrackingStore(store: DevTrackingStore) {
  await mkdir(dirname(devTrackingStoreFile), { recursive: true });
  await writeFile(devTrackingStoreFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readDevJsonBody(request: IncomingMessage, limit: number) {
  const raw = (await readDevRequestBody(request, limit)).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readDevRequestBody(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function parseDevMultipartFile(body: Buffer, contentType: string) {
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

      if (filename && (fieldName === "file" || fieldName === "letter")) {
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

function isAllowedDevLetterUpload(upload: { filename: string; contentType: string; data: Buffer }) {
  return upload.data.length <= 8_000_000 && Boolean(normalizeDevLetterExtension(upload.filename, upload.contentType));
}

function normalizeDevLetterExtension(filename: string, contentType = "") {
  const extension = extname(filename).toLowerCase();
  if ([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"].includes(extension)) {
    return extension;
  }

  const byType: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"
  };
  return byType[contentType] ?? "";
}

async function serveDevMedia(pathname: string, response: ServerResponse) {
  const candidate = resolveDevMediaPath(pathname);
  try {
    await readFile(candidate);
  } catch {
    sendDevJson(response, 404, { error: "Media not found." });
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", devMimeTypes[extname(candidate).toLowerCase()] ?? "application/octet-stream");
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  createReadStream(candidate).pipe(response);
}

function resolveDevMediaPath(pathname: string) {
  const safePath = normalize(decodeURIComponent(pathname.replace(/^\/media\//, ""))).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(devUploadsDir, safePath);
  if (!candidate.startsWith(devUploadsDir)) {
    throw new Error("Media path is outside uploads.");
  }
  return candidate;
}

function toDevSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function sendDevJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function publicDevTrackingSite(site: TrackingSite) {
  const {
    ownerContactName,
    contactPriority,
    mailingStatus,
    firstMailedAt,
    lastMailedAt,
    royalMailTrackingNumber,
    trackingStatus,
    trackingLastCheckedAt,
    privateNotes,
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
  void contactPriority;
  void mailingStatus;
  void firstMailedAt;
  void lastMailedAt;
  void royalMailTrackingNumber;
  void trackingStatus;
  void trackingLastCheckedAt;
  void privateNotes;
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

function normalizeLookupText(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizePostcode(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractPostcode(address: string) {
  const match = address.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match ? normalizePostcode(match[1]) : "";
}
