import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { atomicWrite } from "./state-store.mjs";
import { publicStaticRoutes } from "../src/lib/publicRoutes.js";

export const isIndexableRoute = route => typeof route === "string" && (publicStaticRoutes.includes(route) || /^\/developments\/[^/?#\s]+$/.test(route));

export function sitemapXml(routes, origin, publishedAt) {
  const escape = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const date = publishedAt && Number.isFinite(Date.parse(publishedAt)) ? `<lastmod>${new Date(publishedAt).toISOString()}</lastmod>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${escape(origin + route)}</loc>${date}</url>`).join("\n")}\n</urlset>\n`;
}
export async function createSearchIndexing({ directory, secret, encode, decode, origin, enabled = process.env.NODE_ENV === "production", endpoint = "https://api.indexnow.org/indexnow" }) {
  const file = join(directory, "private", "search-indexing.json");
  const key = process.env.INDEXNOW_KEY || createHmac("sha256", secret).update("kingsvale-indexnow-v1").digest("hex");
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("Invalid IndexNow verification key.");
  let state = { pending: [], inflight: [], attempts: 0, nextAttemptAt: 0, lastSubmittedAt: null, lastError: "" }, queue = Promise.resolve(), running = false;
  try { state = { ...state, ...decode(await readFile(file, "utf8")) }; } catch (error) { if (error.code !== "ENOENT") throw error; }
  state.pending = [...new Set([...state.pending, ...state.inflight])]; state.inflight = [];
  const mutate = action => { const next = queue.catch(() => {}).then(async () => { action(); await atomicWrite(file, encode(state)); }); queue = next; return next; };
  const enqueue = routes => mutate(() => { state.pending = [...new Set([...state.pending, ...routes.filter(isIndexableRoute).map(route => origin + route)])]; state.nextAttemptAt = 0; }).catch(error => { state.lastError = "Could not save the search notification queue."; throw error; });
  async function tick() {
    if (!enabled || running || !state.pending.length || state.nextAttemptAt > Date.now()) return;
    running = true;
    const batch = state.pending.slice(0, 10000);
    // Remove this batch before sending so a newer publication of the same URL
    // remains queued if it arrives while the request is in flight.
    try {
      await mutate(() => { state.inflight = batch; state.pending = state.pending.filter(url => !batch.includes(url)); });
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: new URL(origin).host, key, keyLocation: `${origin}/${key}.txt`, urlList: batch }), signal: AbortSignal.timeout(10000) });
      if (![200, 202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}.`);
      await mutate(() => { state.inflight = []; state.attempts = 0; state.lastError = ""; state.lastSubmittedAt = new Date().toISOString(); });
    } catch (error) {
      await mutate(() => { state.inflight = []; state.pending = [...new Set([...batch, ...state.pending])]; state.attempts += 1; state.lastError = error.message; state.nextAttemptAt = Date.now() + Math.min(86400000, 60000 * 2 ** Math.min(10, state.attempts)); });
    } finally { running = false; }
  }
  return { keyPath: `/${key}.txt`, key, enqueue, tick, status: () => ({ enabled, queued: state.pending.length + state.inflight.length, lastSubmittedAt: state.lastSubmittedAt, lastError: state.lastError, nextAttemptAt: state.nextAttemptAt ? new Date(state.nextAttemptAt).toISOString() : null }) };
}
