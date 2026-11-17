import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { atomicWrite } from "./state-store.mjs";

const cookieName = "kingsvale_documents";
const filenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,219}\.(webp|avif|png|jpe?g|pdf|docx?)$/i;
const hash = value => createHash("sha256").update(value).digest("hex");
const privateFields = new Set(["titleDeedFileUrl", "letterFileUrl", "letterTemplateUrl", "templateUrl"]);
export function documentFilename(value) {
  if (typeof value !== "string" || !value.startsWith("/media/")) return null;
  try { const name = decodeURIComponent(value.slice(7)); return filenamePattern.test(name) ? name : null; } catch { return null; }
}
export function privateReferences(value, result = new Set(), parent = "") {
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    if (privateFields.has(key) || (parent === "letterDocuments" && key === "url")) { const filename = documentFilename(child); if (filename) result.add(filename); }
    if (Array.isArray(child)) child.forEach(item => privateReferences(item, result, key));
    else if (child && typeof child === "object") privateReferences(child, result, parent);
  }
  return result;
}
export function validateDocumentAccess(value) {
  if (!value || !Array.isArray(value.files) || value.files.length > 20000 || value.files.some(name => !filenamePattern.test(name))) throw new Error("Invalid private document manifest.");
  return { files: [...new Set(value.files)] };
}
export function createDocumentAccess({ directory, uploads, encode, decode, secret }) {
  const path = join(directory, "private", "document-access.json");
  let state = { files: [], shares: [] }, pending = Promise.resolve();
  const sign = value => createHmac("sha256", secret).update(value).digest("hex");
  const mutate = action => { const next = pending.catch(() => {}).then(async () => { const result = await action(); await atomicWrite(path, encode(state)); return result; }); pending = next; return next; };
  const legacyPrivate = name => /\.(pdf|docx?)$/i.test(name) || /-\d{13}-[a-f0-9]{8}\.(png|jpe?g|webp)$/i.test(name);
  async function protect(names) { const next = [...names].filter(name => filenamePattern.test(name) && !state.files.includes(name)); if (next.length) await mutate(() => { state.files = [...new Set([...state.files, ...next])]; }); }
  const classify = (names, publicMedia = []) => protect(names.filter(name => legacyPrivate(name) || (!/-[a-f0-9]{24}-\d+\.webp$/i.test(name) && !publicMedia.includes(name))));
  async function initialize(references, publicMedia = []) {
    try { state = decode(await readFile(path, "utf8")); validateDocumentAccess(state); if (!Array.isArray(state.shares)) throw new Error("Invalid document shares."); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    // Unassigned legacy images have no public provenance. Website image uploads
    // have a distinct generated variant name; explicitly published legacy photos
    // remain public unless also referenced by a private document field.
    await classify(await readdir(uploads), publicMedia);
    await protect(privateReferences(references));
  }
  const isPrivate = name => legacyPrivate(name) || state.files.some(file => file.toLowerCase() === name.toLowerCase());
  function setCookie(response, session) {
    const expires = String(session.expiresAt);
    const cookie = `${cookieName}=${expires}.${sign(`documents:${expires}`)}; Path=/media/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor((Number(expires) - Date.now()) / 1000))}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    const existing = response.getHeader("Set-Cookie"); response.setHeader("Set-Cookie", [...(Array.isArray(existing) ? existing : existing ? [existing] : []), cookie]);
  }
  function hasSession(request) {
    const cookie = String(request.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!/^\d{13}\.[a-f0-9]{64}$/.test(cookie || "")) return false;
    const [expires = "", signature = ""] = cookie.split(".");
    return /^\d{13}$/.test(expires) && Number(expires) > Date.now() && /^[a-f0-9]{64}$/.test(signature) && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`documents:${expires}`)));
  }
  async function createShare(filename, hours) {
    if (!isPrivate(filename) || ![1, 24, 168].includes(hours)) throw new Error("Choose a private document and a 1 hour, 24 hour or 7 day expiry.");
    const token = randomBytes(32).toString("base64url");
    return mutate(() => {
      state.shares = state.shares.filter(item => Date.parse(item.expiresAt) > Date.now() && !item.revokedAt);
      if (state.shares.length >= 200) throw new Error("Revoke an existing share before creating another.");
      const entry = { id: randomBytes(12).toString("hex"), filename, digest: hash(token), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + hours * 3600000).toISOString() };
      state.shares.push(entry); return { id: entry.id, expiresAt: entry.expiresAt, url: `/shared-document/${token}` };
    });
  }
  const shares = filename => state.shares.filter(item => item.filename === filename && !item.revokedAt && Date.parse(item.expiresAt) > Date.now()).map(({ digest, filename, ...entry }) => entry);
  const sharedFile = token => { if (!/^[\w-]{43}$/.test(token)) return null; return state.shares.find(item => !item.revokedAt && Date.parse(item.expiresAt) > Date.now() && item.digest === hash(token))?.filename ?? null; };
  const revoke = id => mutate(() => { const entry = state.shares.find(item => item.id === id); if (entry) entry.revokedAt = new Date().toISOString(); });
  const restore = value => protect(validateDocumentAccess(value).files);
  return { initialize, classify, protect, protectReferences: value => protect(privateReferences(value)), isPrivate, setCookie, hasSession, createShare, shares, sharedFile, revoke, export: () => ({ files: [...state.files] }), restore };
}

export function privateMediaHeaders(response, filename, disposition = "inline") {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Cookie, Authorization");
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.setHeader("Referrer-Policy", "no-referrer");
  const mode = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".avif"].includes(extname(filename).toLowerCase()) ? disposition : "attachment";
  response.setHeader("Content-Disposition", `${mode}; filename="${filename}"`);
}
