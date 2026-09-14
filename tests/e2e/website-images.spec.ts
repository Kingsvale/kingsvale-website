import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";

test("studio image workspace uploads, saves drafts, previews projects and exports media", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("tab", { name: "Images & galleries" }).click();
  await expect(page.getByRole("heading", { name: "Your project photographs, in place." })).toBeVisible();
  await expect(page.frameLocator(".admin-preview__frame").getByRole("heading", { name: "The Ridings", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("studio-image-workspace.png"), fullPage: true });
  await page.getByLabel("Search website images").fill("Ridings");
  await page.getByRole("button", { name: "Placeholder The Ridings — cover", exact: true }).click();
  const image = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#567451" } }).png().toBuffer();
  await page.getByLabel("Upload The Ridings — cover", { exact: true }).setInputFiles({ name: "studio-test-ridings-garden.png", mimeType: "image/png", buffer: image });
  await expect(page.getByLabel("The Ridings — cover alt text")).toHaveValue("studio test ridings garden");
  await page.getByLabel("The Ridings — cover alt text").fill("The Ridings garden and landscaped borders");
  await page.getByText("Adjust crop & focal point", { exact: true }).first().click();
  const range = page.getByLabel("The Ridings — cover horizontal position");
  await range.focus(); await range.press("Home"); await range.press("ArrowRight");
  await expect(range).toHaveValue("1");
  await page.getByLabel("Add The Ridings gallery images").setInputFiles([
    { name: "studio-test-interior.png", mimeType: "image/png", buffer: image },
    { name: "studio-test-exterior.png", mimeType: "image/png", buffer: image }
  ]);
  await expect(page.getByText("2 images added to the gallery.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/Draft saved on this browser/)).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Images & galleries" }).click();
  await expect(page.getByLabel("The Ridings — cover alt text")).toHaveValue("The Ridings garden and landscaped borders");
  await expect(page.getByLabel("Preview page")).toHaveValue("/developments/ridings");
  await page.getByRole("button", { name: "Phone", exact: true }).last().click();
  await expect(page.getByTitle("Live The Ridings Phone preview")).toBeVisible();
  await expect(page.frameLocator(".admin-preview__frame").getByAltText("The Ridings garden and landscaped borders").first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("studio-image-editor.png"), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/Published\. The public site/)).toBeVisible();
  await page.getByRole("tab", { name: "Backup", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const download = await downloading;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.version).toBe(2);
  const cover = backup.stores.cms.published.developments[0].image;
  expect(cover.focalPoint).toBe("1% 50%");
  expect(backup.media.find((file: { filename: string }) => `/media/${file.filename}` === cover.src).data.length).toBeGreaterThan(0);
  await page.goto("/developments/ridings");
  await expect(page.getByAltText("The Ridings garden and landscaped borders").first()).toBeVisible();
});
