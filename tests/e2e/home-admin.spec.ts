import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { studioPath } from "../../src/lib/studioRoute";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

async function setRangeValue(page: import("@playwright/test").Page, label: string, value: string) {
  await page.getByLabel(label).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("views homepage, edits admin content, uploads an image and verifies publication", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Shaping exceptional communities. Building lasting value."
    })
  ).toBeVisible();

  await page.getByRole("link", { name: "Discover our developments" }).click();
  await expect(page).toHaveURL(/\/developments$/);
  await expect(
    page.getByRole("heading", { name: "Distinctive homes in carefully chosen locations." })
  ).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "No editor lives here." })).toBeVisible();

  await page.goto(studioPath);
  await expect(page.getByRole("heading", { name: "Sign in to manage the site." })).toBeVisible();
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await expect(page.getByRole("heading", { name: "Kingsvale private studio" })).toBeVisible();

  await page.getByLabel("Hero title").fill("Crafted homes for modern country living.");
  await page.getByRole("tab", { name: "Developments" }).click();
  await page.getByLabel("Development 1 title").fill("Riverstone Mews");
  await page.getByRole("tab", { name: "Hero" }).click();
  await page.getByTestId("hero-image-upload").setInputFiles({
    name: "hero.png",
    mimeType: "image/png",
    buffer: onePixelPng
  });
  await expect(page.getByLabel("Hero image URL")).toHaveValue(/data:image\/png/);

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/Published. The public site is updated/)).toBeVisible();

  await page.getByRole("tab", { name: "Analytics" }).click();
  await expect(page.getByRole("region", { name: "Website analytics" })).toBeVisible();
  await expect(page.getByText("Total visits")).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Crafted homes for modern country living." })
  ).toBeVisible();
  await expect(page.getByText("Riverstone Mews")).toBeVisible();
});

test("creates a land interest map page and opens the generated link", async ({ page }, testInfo) => {
  const projectName = testInfo.project.name.replace(/[^a-z0-9]+/gi, "").toUpperCase() || "WEB";
  const reference = `KV-${projectName}-${Date.now().toString(36).toUpperCase()}`;

  await page.goto(studioPath);
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await expect(page.getByRole("heading", { name: "Kingsvale private studio" })).toBeVisible();

  await page.getByRole("tab", { name: "Sites" }).click();
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByLabel("QR code preview")).toBeVisible();
  const qrDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /download png/i }).click();
  const download = await qrDownload;
  expect(download.suggestedFilename()).toMatch(/-qr\.png$/);
  const qrPath = await download.path();
  expect(qrPath).toBeTruthy();
  const qrBytes = await readFile(qrPath as string);
  expect(qrBytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(qrBytes.readUInt32BE(16)).toBe(1155);
  expect(qrBytes.readUInt32BE(20)).toBe(1155);
  await setRangeValue(page, "Finder roundness", "86");
  await setRangeValue(page, "Cut corners", "34");
  await page.getByLabel("Site title").fill("Oakdene land interest");
  await page.getByLabel("Reference").fill(reference);
  await page.getByLabel("Site address").fill("12 Meadow Lane, Wokingham");
  await expect(page.getByLabel("Folder / region")).toHaveValue("Wokingham");
  await page
    .getByLabel("Google My Maps embed URL or iframe")
    .fill("https://www.google.com/maps/d/embed?mid=abc123");
  await page.getByRole("button", { name: "Add resource" }).click();
  await page.getByLabel(/Resource 1 title/).fill("Title plan");
  await page.getByLabel(/Resource 1 URL/).fill("https://example.com/title-plan.pdf");
  await page.getByRole("button", { name: "Save site" }).click();
  await expect(page.getByText("Map page saved.")).toBeVisible();

  const trackingLink = await page.getByTestId("generated-tracking-link").inputValue();
  expect(trackingLink).toContain("/track/");

  await page.goto(trackingLink);
  await expect(page.getByRole("heading", { name: "Oakdene land interest" })).toBeVisible();
  await expect(page.getByText("12 Meadow Lane, Wokingham")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /View the area Kingsvale is interested in/i })
  ).toBeVisible();
  await expect(page.locator("iframe[title='Oakdene land interest map']")).toHaveAttribute(
    "src",
    /basemap=satellite/
  );
  await expect(page.getByRole("heading", { name: "Supporting information" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Title plan" })).toBeVisible();
});

test("mobile navigation is keyboard and touch accessible", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation behavior is covered by the mobile project.");

  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page
    .getByTestId("site-header")
    .getByRole("link", { name: "Land Wanted", exact: true })
    .click();
  await expect(page).toHaveURL(/\/land-wanted$/);
  await expect(page.getByRole("heading", { name: "Do you have land with potential?" })).toBeVisible();
});
