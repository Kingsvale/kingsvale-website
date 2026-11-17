import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { defaultContent } from "../../src/data/defaultContent";
import { createTrackingSite } from "../../src/lib/trackingStorage";

let server: ChildProcess, directory: string, base: string;
const password = "studio-upgrade-browser-test";
test.use({ userAgent: "Mozilla/5.0 KingsvaleBrowserTest Chrome/130.0.0.0", extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.10" } });
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "kingsvale-ui-upgrade-"));
  await mkdir(join(directory, "cms")); await mkdir(join(directory, "tracking-sites")); await mkdir(join(directory, "uploads"));
  await copyFile("public/brand/kingsvale-logo.png", join(directory, "uploads/selected-hero.png"));
  await copyFile("public/brand/kingsvale-logo.png", join(directory, "uploads/private-deed.png"));
  const content = structuredClone(defaultContent);
  content.hero.image = { src: "/media/selected-hero.png", alt: "Selected hero fixture", focalPoint: "50% 50%" };
  await writeFile(join(directory, "cms/content.json"), JSON.stringify({ published: content, draft: content, revisions: [], updatedAt: new Date().toISOString() }));
  const site = { ...createTrackingSite(), id: "browser-site", token: "browser-site-qr-token", reference: "KV-TEST-001", title: "Studio test site", mailingStatus: "ready-to-mail", remailReminderDate: "2020-01-01", mapEmbedUrl: "", titleDeedFileUrl: "/media/private-deed.png", titleDeedFileName: "Test deed.png" };
  await writeFile(join(directory, "tracking-sites/sites.json"), JSON.stringify({ sites: [site] }));
  server = spawn(process.execPath, ["server/secure-server.mjs"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: "0", KINGSVALE_DATA_DIR: directory, NODE_ENV: "test", STUDIO_USER: "kingsvale", STUDIO_PASSWORD: password, STUDIO_AUTH_TOKEN_SECRET: "browser-test-key", CMS_ENCRYPTION_KEY: "", STUDIO_TOTP_SECRET: "", SMTP_PASSWORD: "", TRUSTED_PROXY_CIDRS: "127.0.0.1/32,::1/128", CLIENT_IP_HEADER: "x-forwarded-for" } });
  let errors = ""; server.stderr?.on("data", data => { errors += data.toString(); });
  base = await new Promise<string>((done, reject) => { const timer = setTimeout(() => reject(new Error(errors || "Server timeout")), 10000); server.stdout?.on("data", data => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); done(match[0]); } }); server.once("exit", code => { clearTimeout(timer); reject(new Error(`Server ${code}: ${errors}`)); }); });
});

test("private document previews, native downloads, temporary sharing and session renewal", async ({ page, context, browser }, testInfo) => {
  await page.goto(`${base}/studio?tab=sites`);
  await page.getByLabel("Studio passphrase").fill(password);
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("button", { name: "Preview / Share" }).click();
  const preview = page.getByRole("dialog");
  const picture = preview.getByRole("img", { name: "Document preview", exact: true });
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const download = page.waitForEvent("download");
  await preview.getByRole("link", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("private-deed.png");
  await preview.getByText("Share this document temporarily", { exact: true }).click();
  await preview.getByRole("button", { name: "Create temporary link" }).click();
  const shared = await preview.getByLabel("Share link", { exact: true }).inputValue();
  const outsider = await browser.newContext();
  expect((await outsider.request.get(`${base}/media/private-deed.png`)).status()).toBe(401);
  expect((await outsider.request.get(shared)).status()).toBe(200);
  await page.screenshot({ path: testInfo.outputPath("private-document-sharing.png"), fullPage: true });
  await preview.getByRole("button", { name: "Revoke link" }).click();
  await expect(preview.getByRole("status")).toHaveText("Access through that link has been revoked.");
  expect((await outsider.request.get(shared)).status()).toBe(404);
  await outsider.close();
  await preview.getByRole("button", { name: "Close preview" }).click();
  await context.clearCookies();
  await page.reload();
  await page.getByRole("button", { name: "Preview / Share" }).click();
  await expect.poll(() => page.getByRole("img", { name: "Document preview", exact: true }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const cookie = (await context.cookies(`${base}/media/private-deed.png`)).find(item => item.name === "kingsvale_documents");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
});

test("keyboard navigation, visible content and narrow layouts", async ({ page }) => {
  await page.goto(`${base}/`);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await page.locator("main h2").evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).opacity !== "0"))).toBe(true);
    if (width <= 860) {
      await page.getByRole("button", { name: "Open navigation" }).press("Enter");
      await expect(page.locator("#primary-navigation a").first()).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(page.locator("#primary-navigation a").last()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    }
  }
  expect((await page.goto(`${base}/missing-browser-page`))?.status()).toBe(404);
  await page.getByRole("link", { name: "Return to homepage", exact: true }).click();
  await expect(page.locator(".hero__image")).toBeVisible();
});
test.afterAll(async () => {
  if (server?.exitCode === null) { const closed = new Promise(done => server.once("exit", done)); server.kill(); await closed; }
  if (directory) { expect(resolve(directory).startsWith(resolve(tmpdir()) + sep + "kingsvale-ui-upgrade-")).toBeTruthy(); await rm(directory, { recursive: true, force: true }); }
});

test("published hero is present before scripts and hydrates without fallback photos", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).heroSources = [];
    new MutationObserver(() => { const source = document.querySelector(".hero__image")?.getAttribute("src"); if (source) (window as any).heroSources.push(source); }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
  });
  const response = await page.goto(`${base}/`);
  expect(await response!.text()).toContain('src="/media/selected-hero.png"');
  await expect(page.locator(".hero__image")).toHaveAttribute("src", "/media/selected-hero.png");
  await expect.poll(() => page.evaluate(() => (window as any).heroSources.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => [...new Set((window as any).heroSources)])).toEqual(["/media/selected-hero.png"]);
  await page.goto(`${base}/developments`); await expect(page.locator("h1")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Studio overview, external QR activity, excluded editor views and revocable AI connections", async ({ page, browser }, testInfo) => {
  await page.goto(`${base}/studio?tab=overview`);
  await page.getByLabel("Studio passphrase").fill(password); await page.getByRole("button", { name: "Unlock studio" }).click();
  await expect(page.getByRole("heading", { name: "Your work at a glance" })).toBeVisible();
  await expect(page.getByRole("button", { name: /KV-TEST-001/ }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("overview.png"), fullPage: true });
  await page.getByRole("tab", { name: "QR views", exact: true }).click();
  await expect(page.locator(".qr-view-badge").getByText("Not yet viewed", { exact: true })).toBeVisible();
  await page.getByText("Your traffic exclusions", { exact: true }).click();
  await expect(page.getByText(/This network is excluded/)).toBeVisible();
  const visitor = await browser.newContext({ userAgent: "Mozilla/5.0 ExternalQRViewer Chrome/130", extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.70" } });
  const tab = await visitor.newPage(); await tab.goto(`${base}/track/browser-site-qr-token`);
  await expect(tab.getByRole("heading", { name: "Studio test site" })).toBeVisible();
  await tab.waitForResponse(response => response.url().endsWith("/view") && response.status() === 202);
  await visitor.close();
  await page.getByRole("button", { name: "Refresh views" }).click();
  await expect(page.locator(".qr-view-badge").getByText("Viewed externally", { exact: true })).toBeVisible();
  await expect(page.getByText("1 network", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("qr-views.png"), fullPage: true });
  await page.getByRole("tab", { name: "AI connections" }).click();
  await page.getByLabel("Connection name").fill("Browser test assistant");
  await page.getByRole("button", { name: "Create access key" }).click();
  await expect(page.getByLabel("Copy this key once")).toHaveValue(/^kv_relay_/);
  const token = await page.getByLabel("Copy this key once").inputValue();
  const allowed = await page.request.get(`${base}/api/relay/v1/website`, { headers: { Authorization: `Bearer ${token}` } }); expect(allowed.status()).toBe(200);
  await page.getByRole("button", { name: "Hide key" }).click();
  await page.screenshot({ path: testInfo.outputPath("connections.png"), fullPage: true });
  await page.getByRole("button", { name: "Revoke access" }).click(); await expect(page.getByText("Connection revoked.", { exact: true })).toBeVisible();
  expect((await page.request.get(`${base}/api/relay/v1/website`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
  await page.getByRole("tab", { name: "Website", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeDisabled();
  const before = await page.getByLabel("Hero title", { exact: true }).inputValue();
  await page.getByLabel("Hero title", { exact: true }).fill("A revised website title");
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(page.getByLabel("Hero title", { exact: true })).toHaveValue(before);
  await page.getByRole("button", { name: "Redo edit" }).click();
  await page.getByLabel("Hero title", { exact: true }).press("Control+s");
  await expect(page.getByText(/Draft saved on the backend/)).toBeVisible();
  await page.getByRole("button", { name: "Reload saved draft" }).click();
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeDisabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
});
