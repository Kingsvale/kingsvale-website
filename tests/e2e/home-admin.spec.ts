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

test("creates a customer tracking site and opens the generated link", async ({ page }) => {
  await page.goto(studioPath);
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await expect(page.getByRole("heading", { name: "Kingsvale private studio" })).toBeVisible();

  await page.getByRole("tab", { name: "Sites" }).click();
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByLabel("QR code preview")).toBeVisible();
  await setRangeValue(page, "Finder roundness", "86");
  await setRangeValue(page, "Cut corners", "34");
  await page.getByLabel("Site title").fill("Oakdene planning tracker");
  await page.getByLabel("Site address").fill("12 Meadow Lane");
  await page.getByLabel("Apply status template").selectOption("construction");
  await page.getByRole("button", { name: "Add resource" }).click();
  await page.getByLabel(/Resource 1 title/).fill("Planning pack");
  await page.getByLabel(/Resource 1 URL/).fill("https://example.com/planning-pack.pdf");
  await page.getByRole("button", { name: "Save site" }).click();
  await expect(page.getByText("Tracking page saved.")).toBeVisible();

  const trackingLink = await page.getByTestId("generated-tracking-link").inputValue();
  expect(trackingLink).toContain("/track/");

  await page.goto(trackingLink);
  await expect(page.getByRole("heading", { name: "Oakdene planning tracker" })).toBeVisible();
  await expect(page.getByText("12 Meadow Lane")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Milestones" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Images and documents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planning pack" })).toBeVisible();
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
