import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite, revisionOf } from "./state-store.mjs";

const scopes = ["website:read", "website:draft:write", "media:upload", "sites:read", "sites:write"];
const siteFields = ["title", "summary", "currentStatus", "statusNote", "plotDescription", "landAddress", "mapEmbedUrl", "landMap", "resources", "privateNotes", "ownerContactName", "contactPriority", "region"];
const hash = value => createHash("sha256").update(value).digest("hex");
export function createStudioRelay(deps) {
  const file = join(deps.directory, "private", "relay-keys.json");
  async function read() {
    try { return deps.decode(await readFile(file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return { keys: [] }; throw error; }
  }
  const write = store => atomicWrite(file, deps.encode(store));
  const safeKey = ({ digest, ...key }) => key;
  async function handle(request, response, url) {
    const { sendJson: send, readJsonBody: body } = deps;
    if (url.pathname === "/api/studio/integrations") {
      const session = deps.requireSession(request, response);
      if (!session) return;
      const store = await read();
      if (request.method === "GET") { send(response, 200, { keys: store.keys.map(safeKey), scopes }); return; }
      const payload = await body(request, 10000);
      if (request.method === "DELETE") {
        const key = store.keys.find(item => item.id === payload.id);
        if (!key) { send(response, 404, { error: "Integration not found." }); return; }
        key.revokedAt = new Date().toISOString(); await write(store);
        await deps.audit("relay_key_revoked", request, { user: session.user, keyId: key.id });
        send(response, 200, { ok: true }); return;
      }
      if (request.method !== "POST") { send(response, 405, { error: "Method not allowed." }); return; }
      if (typeof payload.name !== "string" || !payload.name.trim() || payload.name.length > 80 || !Array.isArray(payload.scopes) || !payload.scopes.length || payload.scopes.some(scope => !scopes.includes(scope))) { send(response, 422, { error: "Enter a name and valid permissions." }); return; }
      if ((payload.scopes.includes("sites:write") && !payload.scopes.includes("sites:read")) || (payload.scopes.includes("website:draft:write") && !payload.scopes.includes("website:read"))) { send(response, 422, { error: "Editing requires the matching read permission so the connection can review the current record and its revision." }); return; }
      const allowedSites = (await deps.readTracking()).sites.map(site => site.id);
      const siteIds = [...new Set(Array.isArray(payload.siteIds) ? payload.siteIds : [])];
      if (payload.scopes.some(scope => scope.startsWith("sites:")) && (!siteIds.length || siteIds.some(id => !allowedSites.includes(id)))) { send(response, 422, { error: "Choose the sites this integration may access." }); return; }
      if (store.keys.filter(key => !key.revokedAt && Date.parse(key.expiresAt) > Date.now()).length >= 20) { send(response, 422, { error: "Revoke an unused integration before creating another." }); return; }
      const days = Number(payload.expiresInDays ?? 90);
      if (![7, 30, 90].includes(days)) { send(response, 422, { error: "Choose a 7, 30 or 90 day expiry." }); return; }
      const id = randomBytes(8).toString("hex");
      const token = `kv_relay_${id}_${randomBytes(32).toString("base64url")}`;
      const key = { id, name: payload.name.trim(), scopes: [...new Set(payload.scopes)], siteIds, digest: hash(token), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + days * 86400000).toISOString(), revokedAt: null };
      store.keys.push(key); await write(store);
      await deps.audit("relay_key_created", request, { user: session.user, keyId: id, scopes: key.scopes, siteIds });
      send(response, 201, { key: safeKey(key), token }); return;
    }
    const token = String(request.headers.authorization || "").replace(/^Bearer /, "");
    const digest = hash(token);
    const key = (await read()).keys.find(item => !item.revokedAt && Date.parse(item.expiresAt) > Date.now() && item.digest.length === digest.length && timingSafeEqual(Buffer.from(item.digest), Buffer.from(digest)));
    if (!key) { send(response, 401, { error: "A valid integration key is required." }); return; }
    const permit = scope => { if (key.scopes.includes(scope)) return true; send(response, 403, { error: `Permission required: ${scope}` }); return false; };
    const actor = { user: `integration:${key.name}`, keyId: key.id };
    const path = url.pathname.slice("/api/relay/v1".length);
    if (path === "" || path === "/") {
      if (request.method !== "GET") { send(response, 405, { error: "Method not allowed." }); return; }
      send(response, 200, { version: 1, scopes: key.scopes, siteIds: key.siteIds, publishing: "Website edits are drafts. Publish through Studio.", endpoints: ["GET /website", "PUT /website/draft", "POST /media", "GET /sites", "GET /sites/:id", "PATCH /sites/:id"], siteEditableFields: siteFields, concurrency: "Supply If-Match from the GET response's ETag for every edit." }); return;
    }
    if (path === "/website" && request.method === "GET") {
      if (!permit("website:read")) return;
      const store = await deps.readCms();
      const revision = revisionOf(store.draft ?? store.published);
      response.setHeader("ETag", `"${revision}"`);
      send(response, 200, { draft: store.draft ?? store.published, published: store.published, revision, updatedAt: store.updatedAt }); return;
    }
    if (path === "/website/draft" && request.method === "PUT") {
      if (!permit("website:draft:write")) return;
      const payload = await body(request, 2_000_000);
      const store = await deps.readCms();
      if (!matchesRevision(request, response, store.draft ?? store.published, send)) return;
      const validation = deps.validateContent(payload.content);
      if (!validation.valid) { send(response, 422, { error: "Content validation failed.", errors: validation.errors }); return; }
      store.draft = payload.content; store.updatedAt = new Date().toISOString(); await deps.writeCms(store);
      const revision = revisionOf(store.draft);
      await deps.audit("relay_draft_saved", request, { ...actor, revision });
      response.setHeader("ETag", `"${revision}"`);
      send(response, 200, { ok: true, revision, published: false, reviewUrl: "/studio?tab=website", updatedAt: store.updatedAt }); return;
    }
    if (path === "/media" && request.method === "POST") {
      if (!permit("media:upload")) return;
      await deps.uploadImage(request, response, actor); return;
    }
    if (path === "/sites" && request.method === "GET") {
      if (!permit("sites:read")) return;
      const sites = (await deps.readTracking()).sites.filter(site => key.siteIds.includes(site.id));
      send(response, 200, { sites: sites.map(site => ({ id: site.id, title: site.title, reference: site.reference, revision: revisionOf(site) })) }); return;
    }
    const id = path.match(/^\/sites\/([^/]+)$/)?.[1];
    if (id) {
      if (!key.siteIds.includes(id)) { send(response, 403, { error: "This site is outside the integration's access." }); return; }
      const store = await deps.readTracking();
      const previous = store.sites.find(site => site.id === id);
      if (!previous) { send(response, 404, { error: "Site not found." }); return; }
      if (request.method === "GET") {
        if (!permit("sites:read")) return;
        response.setHeader("ETag", `"${revisionOf(previous)}"`);
        send(response, 200, { site: previous, revision: revisionOf(previous) }); return;
      }
      if (request.method === "PATCH") {
        if (!permit("sites:write")) return;
        if (!matchesRevision(request, response, previous, send)) return;
        const payload = await body(request, 8_000_000);
        if (!payload.changes || Array.isArray(payload.changes) || typeof payload.changes !== "object" || Object.keys(payload.changes).some(field => !siteFields.includes(field))) { send(response, 422, { error: "Use changes with only the documented editable site fields." }); return; }
        const site = deps.normalizeSite({ ...previous, ...payload.changes, ...(Object.hasOwn(payload.changes, "privateNotes") ? { mailingNotes: payload.changes.privateNotes } : {}), updatedAt: new Date().toISOString() });
        const validation = deps.validateSite(site);
        if (!validation.valid) { send(response, 422, { error: "Site validation failed.", errors: validation.errors }); return; }
        store.sites = store.sites.map(item => item.id === id ? site : item); store.updatedAt = site.updatedAt;
        await deps.writeTracking(store);
        const revision = revisionOf(site);
        await deps.audit("relay_site_saved", request, { ...actor, siteId: id, changedFields: Object.keys(payload.changes), revision });
        response.setHeader("ETag", `"${revision}"`);
        send(response, 200, { ok: true, site, revision }); return;
      }
    }
    send(response, 404, { error: "Relay endpoint not found. Publishing, deleting, settings and backups are not available to integrations." });
  }
  return { handle };
}
function matchesRevision(request, response, value, send) {
  const expected = String(request.headers["if-match"] || "").replace(/^"|"$/g, "");
  if (!expected) { send(response, 428, { error: "If-Match is required. Read the resource and use its ETag." }); return false; }
  if (expected !== revisionOf(value)) { send(response, 409, { error: "The resource changed. Read it again and review your changes before retrying.", revision: revisionOf(value) }); return false; }
  return true;
}
