import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

// Never log the webhook URL, response body or raw fetch errors: these can
// contain the webhook token or private proxy/Portainer configuration.
export function deploymentUrl(webhook, revision) {
  if (!webhook) throw new Error("PORTAINER_WEBHOOK_URL is missing. Add the stack webhook in GitHub Actions secrets.");
  if (!/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("A full Git commit SHA is required for deployment.");
  let url;
  try { url = new URL(webhook); } catch { throw new Error("PORTAINER_WEBHOOK_URL is not a valid URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !/\/api\/stacks\/webhooks\/[^/]+$/.test(url.pathname)) {
    throw new Error("Use the HTTPS stack webhook endpoint, not the Portainer dashboard URL.");
  }
  // Community Edition ignores Business Edition's image/tag parameters.
  // The production branch already pins the published image in Compose.
  url.searchParams.delete("pullimage");
  url.searchParams.delete("tag");
  url.searchParams.delete("KINGSVALE_IMAGE_TAG");
  return url;
}

export async function deploy({ webhook, revision, healthUrl, fetchImpl = fetch, wait = sleep, log = console.log, attempts = 36 }) {
  const url = deploymentUrl(webhook, revision);
  const health = new URL(healthUrl);
  if (health.protocol !== "https:" || health.username || health.password) throw new Error("The live health check must use HTTPS.");

  let accepted = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(30_000) });
    } catch {
      // An interrupted request may already have started the deployment.
      if (attempt === 3) throw new Error("Portainer could not be reached reliably. Check the webhook's public HTTPS route and certificate, then inspect the stack before retrying.");
      await wait(10_000);
      continue;
    }
    const html = /text\/html/i.test(response.headers.get("content-type") ?? "");
    const status = response.status;
    await response.body?.cancel();
    if (response.ok && !html) { accepted = true; break; }
    if (status >= 300 && status < 400 || html) {
      throw new Error("The webhook returned a redirect or HTML page, not a Portainer API response. Check the secret and reverse-proxy route.");
    }
    if ((status === 409 || status === 429 || status >= 500) && attempt < 3) {
      log(`Portainer returned HTTP ${status}; retrying shortly.`);
      await wait(10_000);
      continue;
    }
    throw new Error(`Portainer rejected the deployment (HTTP ${status}). Check its stack update logs and webhook settings.`);
  }
  if (!accepted) throw new Error("Portainer did not accept the deployment.");
  log("Portainer accepted the request. Waiting for the new release on the live website.");

  let lastResult = "no health response";
  for (let attempt = 0; attempt < attempts; attempt++) {
    health.searchParams.set("deployment", `${revision}-${attempt}`);
    try {
      const response = await fetchImpl(health, {
        redirect: "manual", headers: { "Cache-Control": "no-cache", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000)
      });
      if (response.ok && /application\/json/i.test(response.headers.get("content-type") ?? "")) {
        const status = await response.json();
        if (status.ok === true && status.revision === revision) {
          log(`Verified live release ${revision}.`);
          return;
        }
        const liveRevision = /^[a-f0-9]{40}$/.test(status.revision ?? "") ? status.revision.slice(0, 7) : "unversioned";
        lastResult = status.ok === true ? `running release ${liveRevision}` : "application is not healthy";
      } else {
        lastResult = `health endpoint returned HTTP ${response.status} without healthy release JSON`;
        await response.body?.cancel();
      }
    } catch { lastResult = "health endpoint unavailable"; }
    if (attempt % 6 === 0) log(`Still waiting: ${lastResult}.`);
    if (attempt + 1 < attempts) await wait(5_000);
  }
  throw new Error(`Deployment was not verified: ${lastResult}. Check that Portainer tracks refs/heads/production, then inspect stack logs and GHCR access. The proxy must point to this stack. See DEPLOYMENT.md.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await deploy({ webhook: process.env.PORTAINER_WEBHOOK_URL, revision: process.env.EXPECTED_REVISION, healthUrl: process.env.DEPLOY_HEALTH_URL });
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
