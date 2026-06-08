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
  await expect(page.getByRole("heading", { name: "Authorised editing only." })).toBeVisible();
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

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Crafted homes for modern country living." })
  ).toBeVisible();
  await expect(page.getByText("Riverstone Mews")).toBeVisible();
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
