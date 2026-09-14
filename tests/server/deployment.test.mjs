import { test } from "node:test";
import assert from "node:assert/strict";
import { deploy, deploymentUrl } from "../../scripts/deploy-portainer.mjs";
import { releaseManifest } from "../../scripts/deployment-manifest.mjs";
import { readFile } from "node:fs/promises";

const revision = "a".repeat(40);
const webhook = "https://portainer.example/api/stacks/webhooks/test-token";
const options = { webhook, revision, healthUrl: "https://website.example/api/ops/health", wait: async () => {}, log: () => {}, attempts: 3 };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("removes unsupported image overrides without dropping proxy parameters", () => {
  const url = deploymentUrl(`${webhook}?pullimage=false&tag=old&route=website`, revision);
  assert.equal(url.searchParams.has("pullimage"), false);
  assert.equal(url.searchParams.get("route"), "website");
  assert.equal(url.searchParams.has("tag"), false);
});

test("deployment manifest pins a published SHA while preserving every environment and volume setting", async () => {
  const compose = await readFile(new URL("../../docker-compose.portainer.yml", import.meta.url), "utf8");
  const manifest = releaseManifest(compose, revision);
  assert.equal(manifest.replace(`kingsvale-website:${revision}`, "kingsvale-website:latest"), compose);
  assert.throws(() => releaseManifest(compose, "latest"), /full Git commit SHA/);
  assert.throws(() => releaseManifest("services: {}", revision), /exactly one/);
  assert.throws(() => releaseManifest(compose + "\n" + compose, revision), /exactly one/);
});

test("rejects missing secrets, dashboard URLs and insecure URLs before any request", async () => {
  for (const value of [undefined, "invalid", "https://portainer.example/#!/auth", webhook.replace("https:", "http:")]) {
    await assert.rejects(deploy({ ...options, webhook: value, fetchImpl: () => assert.fail("must not send") }));
  }
  assert.throws(() => deploymentUrl(webhook, "main"), /full Git commit SHA/);
});

test("rejects redirects and HTML success pages without leaking webhook credentials", async () => {
  for (const response of [new Response("private token", { status: 302 }), new Response("private token", { headers: { "Content-Type": "text/html" } })]) {
    await assert.rejects(deploy({ ...options, fetchImpl: async () => response }), (error) => {
      assert.match(error.message, /redirect or HTML/);
      assert.ok(!error.message.includes("private token"));
      assert.ok(!error.message.includes("test-token"));
      return true;
    });
  }
});

test("waits through old versions and temporary downtime until the exact healthy version is live", async () => {
  const responses = [new Response(null, { status: 202 }), json({ ok: true, revision: "b".repeat(40) }), new Response(null, { status: 503 }), json({ ok: true, revision })];
  const calls = [];
  await deploy({ ...options, fetchImpl: async (url, init) => { calls.push({ url: String(url), init }); return responses.shift(); } });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].init.method, "POST");
  assert.ok(calls.every((call) => call.init.redirect === "manual"));
  assert.notEqual(calls[1].url, calls[2].url);
});

test("an accepted webhook alone cannot pass deployment verification", async () => {
  for (const state of [{ ok: true }, { ok: false, revision }, { ok: true, revision: "b".repeat(40) }]) {
    await assert.rejects(deploy({ ...options, fetchImpl: async (_url, init) => init.method === "POST" ? new Response(null, { status: 204 }) : json(state) }), /Deployment was not verified/);
  }
});

test("retries a busy Portainer and verifies the release after acceptance", async () => {
  const responses = [new Response(null, { status: 409 }), new Response(null, { status: 204 }), json({ ok: true, revision })];
  await deploy({ ...options, fetchImpl: async () => responses.shift() });
  assert.equal(responses.length, 0);
});

test("network errors are bounded and do not expose the secret in errors or logs", async () => {
  let calls = 0;
  await assert.rejects(deploy({ ...options, fetchImpl: async () => { calls++; throw new Error(webhook); } }), (error) => {
    assert.ok(!error.message.includes("test-token"));
    assert.match(error.message, /could not be reached/);
    return true;
  });
  assert.equal(calls, 4);
});
