import { expect, test } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { defaultContent } from "../../src/data/defaultContent";

test("Drive setup, pause, manual backup and compressed restore are usable in Studio", async ({ page, context }, testInfo) => {
  let status = { configured: false, encryptionAvailable: true, connected: false, enabled: false, account: "info@kingsvalehomes.co.uk", clientId: "", redirectUri: "https://kingsvalehomes.co.uk/api/drive-backup/callback", budgetGb: 3, folderUrl: null as string | null, busy: false, phase: "", lastSuccess: null as string | null, lastAttempt: null as string | null, lastError: null, warning: null, retainedBytes: 0, driveFreeBytes: 29e9, history: [] as { id: string; name: string; size: number; createdAt: string }[] };
  let savedSecret = "";
  await context.route("**/api/drive-backup**", (route) => {
    if (route.request().method() === "PUT") {
      const input = route.request().postDataJSON();
      savedSecret = input.clientSecret || savedSecret;
      status = { ...status, ...input, configured: true }; delete (status as Record<string, unknown>).clientSecret;
    }
    if (new URL(route.request().url()).pathname.endsWith("/run")) status = { ...status, busy: true, phase: "Uploading to Google Drive" };
    return route.fulfill({ json: status });
  });
  await page.goto("/studio?tab=backup");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await expect(page.getByRole("heading", { name: "Daily Google Drive backups" })).toBeVisible();
  await page.getByLabel("Google OAuth client ID", { exact: true }).fill("test-client.apps.googleusercontent.com");
  await page.getByLabel("Google OAuth client secret", { exact: true }).fill("test-only-secret");
  await page.getByRole("button", { name: "Save Google setup" }).click();
  await expect(page.getByRole("button", { name: "Connect Google Drive", exact: true })).toBeVisible();
  expect(savedSecret).toBe("test-only-secret");
  await expect(page.getByLabel("Google OAuth client secret", { exact: true })).toHaveValue("");
  status = { ...status, connected: true, enabled: true, folderUrl: "https://drive.google.com/drive/folders/test-folder", lastSuccess: "2026-09-15T02:00:00Z", retainedBytes: 1e8, history: [{ id: "test-file", name: "kingsvale-test.json.gz", size: 1e8, createdAt: "2026-09-15T02:00:00Z" }] };
  await page.reload();
  await page.getByRole("button", { name: "Pause daily backups" }).click();
  await expect(page.getByText("Schedule paused", { exact: true })).toBeVisible();
  expect(status.enabled).toBe(false);
  await page.getByRole("button", { name: "Resume daily backups" }).click();
  await expect(page.getByText("Daily backups on", { exact: true })).toBeVisible();
  const panel = page.locator('.drive-backup');
  await panel.screenshot({ path: testInfo.outputPath("drive-backup.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Back up now", exact: true }).click();
  await expect(page.getByRole("button", { name: "Uploading to Google Drive" })).toBeDisabled();
  const backup = { kind: "kingsvale-full-backup", version: 2, exportedAt: "2026-09-15T02:00:00Z", media: [], stores: { cms: { published: defaultContent, draft: null, revisions: [] }, tracking: { sites: [] }, analytics: { visits: [] }, leads: { contact: "", newsletter: "" } } };
  await page.locator('input[type="file"][accept*=".gz"]').setInputFiles({ name: "kingsvale-test.json.gz", mimeType: "application/gzip", buffer: gzipSync(JSON.stringify(backup)) });
  await expect(page.getByText("Backup loaded from kingsvale-test.json.gz. Review the summary before importing.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import selected backup" })).toBeEnabled();
});
